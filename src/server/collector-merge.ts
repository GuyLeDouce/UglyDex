import 'server-only';
import { db } from './db';

export async function confirmCollectorMerge(
  requestId: string,
  survivorCollectorId: string,
) {
  const result = await db().$transaction(
    async (tx) => {
      const request = await tx.collectorMergeRequest.findUnique({
        where: { id: requestId },
      });
      if (
        !request ||
        request.status !== 'PENDING_CONFIRMATION' ||
        request.expiresAt <= new Date() ||
        request.survivorCollectorId !== survivorCollectorId ||
        request.survivorCollectorId === request.absorbedCollectorId
      )
        throw new Error('MERGE_REQUEST_EXPIRED');

      for (const id of [
        request.survivorCollectorId,
        request.absorbedCollectorId,
      ].sort())
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))`;

      const [survivor, absorbed] = await Promise.all([
        tx.collector.findUnique({ where: { id: request.survivorCollectorId } }),
        tx.collector.findUnique({ where: { id: request.absorbedCollectorId } }),
      ]);
      if (!survivor || !absorbed || absorbed.mergedIntoCollectorId)
        throw new Error('MERGE_REQUEST_EXPIRED');

      const [survivorDrip, absorbedDrip] = await Promise.all([
        tx.dripIdentity.findMany({
          where: { collectorId: survivor.id },
          select: { id: true, realmId: true, dripMemberId: true },
        }),
        tx.dripIdentity.findMany({
          where: { collectorId: absorbed.id },
          select: { id: true, realmId: true, dripMemberId: true },
        }),
      ]);
      if (
        survivorDrip.some((a) =>
          absorbedDrip.some((b) => b.realmId === a.realmId),
        )
      )
        throw new Error('MERGE_CHARM_IDENTITY_CONFLICT');

      const activityCount = await tx.collectorActivity.count({
        where: { collectorId: absorbed.id },
      });
      await tx.$executeRaw`
        INSERT INTO "ActivityCorrection" ("id", "activityId", "reason", "before", "afterHash", "createdAt")
        SELECT gen_random_uuid(), a."id", 'COLLECTOR_MERGE',
          jsonb_build_object('collectorId', a."collectorId", 'discordId', a."discordId", 'walletAddress', a."walletAddress", 'attributionStatus', a."attributionStatus"),
          a."payloadHash", NOW()
        FROM "CollectorActivity" a WHERE a."collectorId" = ${absorbed.id}::uuid
      `;
      await tx.collectorActivity.updateMany({
        where: { collectorId: absorbed.id },
        data: { collectorId: survivor.id, correctedAt: new Date() },
      });

      const discoveries = await tx.squigDiscovery.findMany({
        where: { collectorId: absorbed.id },
      });
      let movedDiscoveries = 0;
      for (const discovery of discoveries) {
        const existing = await tx.squigDiscovery.findUnique({
          where: {
            collectorId_squigId: {
              collectorId: survivor.id,
              squigId: discovery.squigId,
            },
          },
        });
        if (!existing) {
          await tx.squigDiscovery.update({
            where: {
              collectorId_squigId: {
                collectorId: absorbed.id,
                squigId: discovery.squigId,
              },
            },
            data: { collectorId: survivor.id },
          });
        } else {
          const earliest =
            [discovery, existing]
              .filter((row) => row.firstOwnershipPeriod)
              .sort(
                (a, b) => a.discoveredAt.getTime() - b.discoveredAt.getTime(),
              )[0] ??
            (discovery.discoveredAt < existing.discoveredAt
              ? discovery
              : existing);
          await tx.squigDiscovery.update({
            where: {
              collectorId_squigId: {
                collectorId: survivor.id,
                squigId: discovery.squigId,
              },
            },
            data: {
              discoveredAt: earliest.discoveredAt,
              sourceKey: earliest.sourceKey,
              everOwned: discovery.everOwned || existing.everOwned,
              attributionStatus:
                discovery.attributionStatus === 'CONFIRMED' ||
                existing.attributionStatus === 'CONFIRMED'
                  ? 'CONFIRMED'
                  : existing.attributionStatus,
              firstOwnershipPeriod: earliest.firstOwnershipPeriod,
            },
          });
          await tx.squigDiscovery.delete({
            where: {
              collectorId_squigId: {
                collectorId: absorbed.id,
                squigId: discovery.squigId,
              },
            },
          });
        }
        movedDiscoveries++;
      }

      await tx.externalIdentity.updateMany({
        where: { collectorId: absorbed.id },
        data: { collectorId: survivor.id },
      });
      await tx.collectorWallet.updateMany({
        where: { collectorId: absorbed.id },
        data: { collectorId: survivor.id },
      });
      await tx.historicalIdentityAttribution.updateMany({
        where: { collectorId: absorbed.id },
        data: { collectorId: survivor.id },
      });
      await tx.collectorOwnershipPeriod.updateMany({
        where: { collectorId: absorbed.id },
        data: { collectorId: survivor.id },
      });
      await tx.xpLedgerEntry.updateMany({
        where: { subjectType: 'COLLECTOR', subjectId: absorbed.id },
        data: { subjectId: survivor.id },
      });
      await tx.progressionAudit.updateMany({
        where: { subjectType: 'COLLECTOR', subjectId: absorbed.id },
        data: { subjectId: survivor.id },
      });

      const galleries = await tx.collectorGallery.findMany({
        where: { collectorId: absorbed.id },
        select: { id: true, slug: true },
      });
      const usedSlugs = new Set(
        (
          await tx.collectorGallery.findMany({
            where: { collectorId: survivor.id },
            select: { slug: true },
          })
        ).map((gallery) => gallery.slug),
      );
      for (const gallery of galleries) {
        let slug = gallery.slug;
        if (usedSlugs.has(slug)) {
          const base = `${slug}-m${absorbed.id.slice(0, 6)}`;
          slug = base;
          let suffix = 2;
          while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`;
        }
        usedSlugs.add(slug);
        await tx.collectorGallery.update({
          where: { id: gallery.id },
          data: {
            collectorId: survivor.id,
            slug,
            visibility: 'PRIVATE',
            featured: false,
          },
        });
      }

      const displayPreferences = await tx.squigDisplayPreference.findMany({
        where: { collectorId: absorbed.id },
      });
      await tx.squigDisplayPreference.createMany({
        data: displayPreferences.map((pref) => ({
          ...pref,
          collectorId: survivor.id,
        })),
        skipDuplicates: true,
      });
      await tx.squigDisplayPreference.deleteMany({
        where: { collectorId: absorbed.id },
      });

      for (const entitlement of await tx.cosmeticEntitlement.findMany({
        where: { collectorId: absorbed.id },
      })) {
        const existing = await tx.cosmeticEntitlement.findUnique({
          where: {
            collectorId_cosmeticId: {
              collectorId: survivor.id,
              cosmeticId: entitlement.cosmeticId,
            },
          },
        });
        if (!existing)
          await tx.cosmeticEntitlement.update({
            where: {
              collectorId_cosmeticId: {
                collectorId: absorbed.id,
                cosmeticId: entitlement.cosmeticId,
              },
            },
            data: { collectorId: survivor.id },
          });
        else {
          await tx.cosmeticEntitlement.update({
            where: {
              collectorId_cosmeticId: {
                collectorId: survivor.id,
                cosmeticId: entitlement.cosmeticId,
              },
            },
            data: {
              grantedAt:
                entitlement.grantedAt < existing.grantedAt
                  ? entitlement.grantedAt
                  : existing.grantedAt,
              revokedAt:
                existing.revokedAt === null || entitlement.revokedAt === null
                  ? null
                  : existing.revokedAt < entitlement.revokedAt
                    ? existing.revokedAt
                    : entitlement.revokedAt,
            },
          });
          await tx.cosmeticEntitlement.delete({
            where: {
              collectorId_cosmeticId: {
                collectorId: absorbed.id,
                cosmeticId: entitlement.cosmeticId,
              },
            },
          });
        }
      }
      for (const preference of await tx.collectorCosmeticPreference.findMany({
        where: { collectorId: absorbed.id },
      })) {
        const existing = await tx.collectorCosmeticPreference.findUnique({
          where: {
            collectorId_kind: {
              collectorId: survivor.id,
              kind: preference.kind,
            },
          },
        });
        if (existing)
          await tx.collectorCosmeticPreference.delete({
            where: {
              collectorId_kind: {
                collectorId: absorbed.id,
                kind: preference.kind,
              },
            },
          });
        else
          await tx.collectorCosmeticPreference.update({
            where: {
              collectorId_kind: {
                collectorId: absorbed.id,
                kind: preference.kind,
              },
            },
            data: { collectorId: survivor.id },
          });
      }

      await tx.collectionAudit.updateMany({
        where: { collectorId: absorbed.id },
        data: { collectorId: survivor.id },
      });
      await tx.collectorProgress.deleteMany({
        where: { collectorId: { in: [survivor.id, absorbed.id] } },
      });
      await tx.collectorAchievement.deleteMany({
        where: { collectorId: { in: [survivor.id, absorbed.id] } },
      });
      await tx.progressionMilestone.deleteMany({
        where: {
          subjectType: 'COLLECTOR',
          subjectId: { in: [survivor.id, absorbed.id] },
        },
      });
      await tx.progressionJob.deleteMany({
        where: { subjectType: 'COLLECTOR', subjectId: absorbed.id },
      });
      await tx.progressionJob.upsert({
        where: {
          subjectType_subjectId: {
            subjectType: 'COLLECTOR',
            subjectId: survivor.id,
          },
        },
        create: { subjectType: 'COLLECTOR', subjectId: survivor.id },
        update: {
          generation: { increment: 1 },
          queuedAt: new Date(),
          attempts: 0,
          errorCode: null,
        },
      });

      await tx.collectorSetProgress.deleteMany({
        where: { collectorId: { in: [survivor.id, absorbed.id] } },
      });
      await tx.questProgress.deleteMany({
        where: { collectorId: { in: [survivor.id, absorbed.id] } },
      });
      await tx.collectorTraitDiscovery.deleteMany({
        where: { collectorId: { in: [survivor.id, absorbed.id] } },
      });
      await tx.collectionSnapshot.deleteMany({
        where: { collectorId: { in: [survivor.id, absorbed.id] } },
      });
      await tx.collectionMilestone.deleteMany({
        where: { collectorId: { in: [survivor.id, absorbed.id] } },
      });
      await tx.collectionJob.deleteMany({
        where: { collectorId: absorbed.id },
      });
      await tx.collectionJob.upsert({
        where: { collectorId: survivor.id },
        create: { collectorId: survivor.id },
        update: {
          generation: { increment: 1 },
          queuedAt: new Date(),
          attempts: 0,
          errorCode: null,
        },
      });

      if (absorbedDrip.length) {
        await tx.dripIdentity.updateMany({
          where: { collectorId: absorbed.id },
          data: { collectorId: survivor.id },
        });
        await tx.charmBalance.updateMany({
          where: { collectorId: absorbed.id },
          data: { collectorId: survivor.id },
        });
        for (const refresh of await tx.charmRefreshRequest.findMany({
          where: { collectorId: absorbed.id },
        })) {
          const existing = await tx.charmRefreshRequest.findUnique({
            where: {
              realmId_collectorId: {
                realmId: refresh.realmId,
                collectorId: survivor.id,
              },
            },
          });
          if (existing)
            await tx.charmRefreshRequest.delete({
              where: {
                realmId_collectorId: {
                  realmId: refresh.realmId,
                  collectorId: absorbed.id,
                },
              },
            });
          else
            await tx.charmRefreshRequest.update({
              where: {
                realmId_collectorId: {
                  realmId: refresh.realmId,
                  collectorId: absorbed.id,
                },
              },
              data: { collectorId: survivor.id },
            });
        }
      }
      await tx.collectorRefreshRequest.deleteMany({
        where: { collectorId: absorbed.id },
      });
      await tx.authSession.deleteMany({
        where: { collectorId: { in: [survivor.id, absorbed.id] } },
      });
      await tx.authChallenge.deleteMany({
        where: { collectorId: { in: [survivor.id, absorbed.id] } },
      });
      await tx.collectorMergeRequest.updateMany({
        where: {
          id: { not: request.id },
          OR: [
            { survivorCollectorId: absorbed.id },
            { absorbedCollectorId: absorbed.id },
            { survivorCollectorId: survivor.id },
            { absorbedCollectorId: survivor.id },
          ],
          status: 'PENDING_CONFIRMATION',
        },
        data: { status: 'CANCELLED' },
      });
      await tx.collector.update({
        where: { id: absorbed.id },
        data: {
          isPublic: false,
          showWallets: false,
          showDiscord: false,
          showCharmBalance: false,
          mergedIntoCollectorId: survivor.id,
        },
      });
      await tx.collector.update({
        where: { id: survivor.id },
        data: {
          isPublic: false,
          showWallets: false,
          showDiscord: false,
          showCharmBalance: false,
        },
      });

      const reviewCase = await tx.identityReconciliation.findUnique({
        where: { dedupeKey: request.reviewKey },
      });
      if (!reviewCase || reviewCase.status !== 'PENDING')
        throw new Error('MERGE_REQUEST_EXPIRED');
      const confirmedAt = new Date();
      await tx.identityReconciliation.update({
        where: { id: reviewCase.id },
        data: {
          status: 'RESOLVED',
          resolution: {
            action: 'MERGE_COLLECTORS',
            survivorCollectorId: survivor.id,
            absorbedCollectorId: absorbed.id,
            confirmedAt: confirmedAt.toISOString(),
          },
          resolvedAt: confirmedAt,
        },
      });
      await tx.reconciliationDecision.create({
        data: {
          caseId: reviewCase.id,
          actor: `collector:${survivor.id}`,
          action: 'MERGE_COLLECTORS',
          reason: 'DUAL_CREDENTIAL_PROOF_AND_EXPLICIT_CONFIRMATION',
          before: {
            survivorCollectorId: survivor.id,
            absorbedCollectorId: absorbed.id,
            status: 'PENDING',
          },
          after: {
            survivorCollectorId: survivor.id,
            absorbedCollectorId: absorbed.id,
            status: 'MERGED',
            proofs: [
              {
                type: request.survivorCredentialType,
                fingerprint: request.survivorCredentialFingerprint,
              },
              {
                type: request.credentialType,
                fingerprint: request.credentialFingerprint,
              },
            ],
            activityRowsMoved: activityCount,
            discoveriesMerged: movedDiscoveries,
            galleriesMoved: galleries.length,
            confirmedAt: confirmedAt.toISOString(),
          },
        },
      });
      await tx.operationalAudit.create({
        data: {
          actor: `collector:${survivor.id}`,
          action: 'COLLECTOR_MERGE_CONFIRMED',
          subject: `${absorbed.id}->${survivor.id}`,
          detail: {
            mergeRequestId: request.id,
            proofs: [
              {
                type: request.survivorCredentialType,
                fingerprint: request.survivorCredentialFingerprint,
              },
              {
                type: request.credentialType,
                fingerprint: request.credentialFingerprint,
              },
            ],
            activityRowsMoved: activityCount,
            discoveriesMerged: movedDiscoveries,
            galleriesMoved: galleries.length,
            confirmedAt: new Date().toISOString(),
          },
        },
      });
      await tx.collectorMergeRequest.update({
        where: { id: request.id },
        data: { status: 'MERGED', confirmedAt: new Date() },
      });
      return { collectorId: survivor.id };
    },
    { isolationLevel: 'Serializable', timeout: 120000 },
  );
  return result;
}

export async function pendingMergeRequest(id: string, collectorId: string) {
  return db().collectorMergeRequest.findFirst({
    where: {
      id,
      survivorCollectorId: collectorId,
      status: 'PENDING_CONFIRMATION',
      expiresAt: { gt: new Date() },
    },
    include: { survivor: { select: { slug: true } } },
  });
}

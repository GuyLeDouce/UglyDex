import type { ReactNode } from 'react';

export function CardTurn({ children }: { children: ReactNode }) {
  return (
    <div className="squig-spin inline-card-turn">
      <div className="squig-spin-rotor">{children}</div>
    </div>
  );
}

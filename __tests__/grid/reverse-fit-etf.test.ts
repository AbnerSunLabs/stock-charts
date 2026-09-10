import { calculateGridStrategy } from '@/lib/grid-calculator';
import { DEFAULT_GRID_PARAMS, type GridParams } from '@/types/grid';

function dump(
  name: string,
  patch: Partial<GridParams>,
  dyn: { enabled: boolean; mode: 'stable' | 'aggressive' }
): void {
  const params: GridParams = { ...DEFAULT_GRID_PARAMS, ...patch };
  const { gridData } = calculateGridStrategy(params, {
    dynamicGridEnabled: dyn.enabled,
    dynamicGridMode: dyn.mode,
  });
  // eslint-disable-next-line no-console
  console.log(
    '\n',
    name,
    gridData
      .map(r => `${r.gridType} ${r.buyPrice.toFixed(3)} ${r.buyShares} ${r.buyAmount}`)
      .join(' | ')
  );
}

describe('dump', () => {
  it('medical 5000', () => {
    dump(
      '医疗5000',
      {
        basePrice: 0.35,
        minPrice: 0.291,
        amountPerGrid: 5000,
        smallGridStep: 5,
        mediumGridStep: 15,
        largeGridStep: 30,
      },
      { enabled: true, mode: 'stable' }
    );
  });
});

// User journeys (vẽ hồ có đất liền bên trong):
// 1) Các đoạn đường rời rạc nối đầu-cuối tạo thành một vòng kín -> trả về 1 vòng.
// 2) Đoạn đảo chiều (đi ngược) vẫn ghép được vào vòng.
// 3) Hai vòng kín tách rời -> trả về 2 vòng.
// 4) Đoạn không khép kín được -> bỏ qua, không throw.

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRings } = require('../js/lib/ring-builder.js');

const SQUARE_A = [[0, 0], [0, 1]];
const SQUARE_B = [[0, 1], [1, 1]];
const SQUARE_C = [[1, 1], [1, 0]];
const SQUARE_D = [[1, 0], [0, 0]];

test('buildRings: 4 đoạn nối đầu-cuối thành 1 vòng kín', () => {
  const rings = buildRings([SQUARE_A, SQUARE_B, SQUARE_C, SQUARE_D]);
  assert.equal(rings.length, 1);
  assert.equal(rings[0].length, 5);
  assert.deepEqual(rings[0][0], rings[0][rings[0].length - 1]);
});

test('buildRings: đoạn đảo chiều vẫn ghép được vào vòng', () => {
  const rings = buildRings([SQUARE_A, SQUARE_B, SQUARE_C, [[0, 0], [1, 0]]]);
  assert.equal(rings.length, 1);
});

test('buildRings: hai vòng tách rời -> trả về 2 vòng', () => {
  const second = [[5, 5], [5, 6]];
  const second2 = [[5, 6], [6, 6]];
  const second3 = [[6, 6], [6, 5]];
  const second4 = [[6, 5], [5, 5]];
  const rings = buildRings([SQUARE_A, SQUARE_B, SQUARE_C, SQUARE_D, second, second2, second3, second4]);
  assert.equal(rings.length, 2);
});

test('buildRings: đoạn không khép kín -> bỏ qua, không throw', () => {
  assert.deepEqual(buildRings([[[0, 0], [0, 1]]]), []);
  assert.deepEqual(buildRings([]), []);
  assert.deepEqual(buildRings(null), []);
});

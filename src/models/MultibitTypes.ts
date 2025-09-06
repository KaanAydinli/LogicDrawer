export type BitArray = boolean[];

export interface BitValue {
  value: BitArray;
  width: number;
}

export function bitsToNumber(bits: BitArray): number {
  return bits.reduce((result, bit, index) => {
    return result + (bit ? Math.pow(2, bits.length - index - 1) : 0);
  }, 0);
}

export function numberToBits(num: number, width: number): BitArray {
  const result: BitArray = [];
  for (let i = width - 1; i >= 0; i--) {
    result.push(Boolean((num >> i) & 1));
  }
  return result;
}

// Bitwise operations for multi-bit components
export const BitwiseOperations = {
  AND: (a: BitArray, b: BitArray): BitArray => {
    const maxLength = Math.max(a.length, b.length);
    const result: BitArray = [];

    for (let i = 0; i < maxLength; i++) {
      const bitA = i < a.length ? a[i] : false;
      const bitB = i < b.length ? b[i] : false;
      result.push(bitA && bitB);
    }

    return result;
  },

  OR: (a: BitArray, b: BitArray): BitArray => {
    const maxLength = Math.max(a.length, b.length);
    const result: BitArray = [];

    for (let i = 0; i < maxLength; i++) {
      const bitA = i < a.length ? a[i] : false;
      const bitB = i < b.length ? b[i] : false;
      result.push(bitA || bitB);
    }

    return result;
  },

  XOR: (a: BitArray, b: BitArray): BitArray => {
    const maxLength = Math.max(a.length, b.length);
    const result: BitArray = [];

    for (let i = 0; i < maxLength; i++) {
      const bitA = i < a.length ? a[i] : false;
      const bitB = i < b.length ? b[i] : false;
      result.push(bitA !== bitB);
    }

    return result;
  },

  NOT: (a: BitArray): BitArray => {
    return a.map(bit => !bit);
  },
};

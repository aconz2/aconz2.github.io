---
layout: post
title:  "More Hash Filenames"
date:   2026-03-22
categories:
---

In my last post on [Hash Filenames](/2026/01/08/Hash-Filenames.html), I showed a fast 40 byte escaping of a SHA256 32 byte digest suitable for use on Linux filesystems as a filename. This checked for the two bad bytes `\0` and `/`, replaced them, and placed 2 bits per byte at the end to record whether the character was okay, `\0` or `/`.

One part of this encoding that I thought was neat was that the extra bytes at the end were guaranteed not to be `\0` or `/` because the top two bits are never `00`. It occurred to me the other day that we can simplify this even further by just ensuring the top bit of every byte is `1`.

# A 37 byte format

So the new format takes the high bit (msb) of each byte and packs it into the low 7 bits of bytes that go at the end. For a 32 byte input, we pack 32 bits into 5 7-bit bytes at the end. Every bit gets the msb set. This saves 3 bytes and in my testing, performance is still around 2.7 ns for encode/decode without SIMD, and 1.8 ns for encode/decode with SIMD.

```
# 32 byte input
a b c d e f g h | i j k l m n o p | q r s t u v w x | y z A B C D E F

# load to 4 64-bit values (high byte on left as per LE)
hgfedcba | ponmlkji | xwvutsrq | FEDCBAzy

# grab the msb of each byte (letter now represents a bit) and accumulate into 1 32-bit value
msb-|                                       |-lsb
    FEDCBAzy | xwvutsrq | ponmlkji | hgfedcba

# pack the low 28 bits into 4 bytes
msb-|                                 |-lsb
    1BAzyxwv 1utsrqpo 1nmlkjih 1gfedcba

# and the next 4 bits into 1 byte
1___FEDC
```

One benefit of this 37 byte encoding is that it is very fast without SIMD, though it does use pdep/pext which I think can be slow(er) on old architectures.

The implementation is natural with pdep/pext:

```c
void encode_37(const char x[32], char ret[37]) {
    uint32_t bits = 0;
    for (int i = 0; i < 4; i++) {
        uint64_t a;
        memcpy(&a, x + i * 8, 8);
        // grab the msb of each byte, 0x80 == 0b1000_0000
        bits |= _pext_u64(a, 0x8080808080808080) << (i * 8);
        // set the msb of each byte
        a |= 0x8080808080808080;
        memcpy(ret + i * 8, &a, 8);
    }
    //     msb|                                     |lsb
    // bits = dddd_dddd cccc_cccc bbbb_bbbb aaaa_aaaa
    // put 28 bits into the low 7 bits of each byte, 0x7f = 0b0111_1111
    // 1ddd_dccc 1ccc_ccbb 1bbb_bbba 1aaa_aaaa
    uint32_t b = _pdep_u32(bits, 0x7f7f7f7f) | 0x80808080;
    uint8_t c = bits >> 28 | 0x80; // 1xxx_dddd
    memcpy(ret + 32, &b, 4);
    memcpy(ret + 36, &c, 1);
}

void decode_37(const char x[37], char ret[32]) {
    uint32_t b;
    uint8_t c;
    memcpy(&b, x + 32, 4);
    memcpy(&c, x + 36, 1);
    uint32_t bits = _pext_u32(b, 0x7f7f7f7f) | (uint32_t)c << 28;
    for (int i = 0; i < 4; i++) {
        uint64_t a;
        memcpy(&a, x + i * 8, 8);
        // mask off msb of each byte
        a &= 0x7f7f7f7f7f7f7f7f;
        // spread the byte in bits to the msb of each byte
        a |= _pdep_u64(bits & 0xff, 0x8080808080808080);
        bits >>= 8;
        memcpy(ret + i * 8, &a, 8);
    }
}
```

And with SIMD, we get the msb of each byte by checking if the byte is negative, we can only use greater-than so we invert the mask. From there the bit packing is still the same. This uses the same `expand_mask` helper from SO I used in the last post. However, because that function takes 32 bits and expands into 32 bytes where each byte is 0xff if the bit is 1 and 0x00 otherwise, we then have to mask off the low bits to get just the msb.

```c
void encode_37_simd(const char x[32], char ret[37]) {
    __m256i y = _mm256_loadu_si256((__m256i*) x);
    __m256i gte_zero = _mm256_cmpgt_epi8(y, _mm256_set1_epi8(-1));
    uint32_t bits = ~_mm256_movemask_epi8(gte_zero);

    y = _mm256_or_si256(y, _mm256_set1_epi8(0x80));
    _mm256_storeu_si256((__m256i*) ret, y);

    uint32_t b = _pdep_u32(bits, 0x7f7f7f7f);
    b |= 0x80808080;
    uint8_t c = bits >> 28 | 0x80;
    memcpy(ret + 32, &b, 4);
    memcpy(ret + 36, &c, 1);
}

void decode_37_simd(const char x[37], char ret[32]) {
    uint32_t b;
    uint8_t c;
    memcpy(&b, x + 32, 4);
    memcpy(&c, x + 36, 1);
    uint32_t bits = _pext_u32(b, 0x7f7f7f7f) | (uint32_t)c << 28;

    __m256i y = _mm256_loadu_si256((__m256i*) x);

    const __m256i msb_mask = _mm256_set1_epi8(0x80);
    // expand_mask puts 0xff in each byte where the bit is 1
    // so mask off the lower 7 to just get the high bit
    __m256i msb = _mm256_and_si256(expand_mask(bits), msb_mask);

    // these two lines are the same but saves a constant load
    /*y = _mm256_and_si256(y, _mm256_set1_epi8(0x7f));*/
    y = _mm256_andnot_si256(msb_mask, y);

    y = _mm256_or_si256(y, msb);
    _mm256_storeu_si256((__m256i*) ret, y);
}
```

I hadn't spent any time looking at the implementation of `expand_mask` until this point so I stepped through it; it is very clever.

```
my step by step
from the original movemask, the lsb of mask is for lane 0, msb is for lane 31
 bit  31-|                                     |-bit 0
mask is  dddd_dddd cccc_cccc bbbb_bbbb aaaa_aaaa
        lane 3  | lane 2 | lane 1 | lane 0  (64 bit lanes)
shuffle: 0x03...| 0x02...| 0x01...| 0x00...
vmask:   D{8}   | C{8}   | B{8}   | A{8}  # replicate each byte 8 times
in each lane, bit_mask picks out each bit, call the bits of A: ZYXW_VUTS
          ZYXWVUTS_ZYXWVUTS_ZYXWVUTS_ZYXWVUTS_ZYXWVUTS_ZYXWVUTS_ZYXWVUTS_ZYXWVUTS
bit_mask: 01111111_10111111_11011111_11101111_11110111_11111011_11111101_11111110
bit_mask: Z....... .Y...... ..X..... ...W.... ....V... .....U.. ......T. .......S # (. == 1 for readability)
now cmp each byte against 0xff
cmp leaves 0xff for match and 0x00 for no match. Will only match if that one bit was 1
```

```c
// -- this code derived from
// https://stackoverflow.com/questions/21622212/how-to-perform-the-inverse-of-mm256-movemask-epi8-vpmovmskb
__m256i expand_mask(const uint32_t mask) {
    __m256i vmask = _mm256_set1_epi32(mask);
    const __m256i shuffle = _mm256_setr_epi64x(0x0000000000000000, 0x0101010101010101, 0x0202020202020202, 0x0303030303030303);
    vmask = _mm256_shuffle_epi8(vmask, shuffle);
    const __m256i bit_mask = _mm256_set1_epi64x(0x7fbfdfeff7fbfdfe);
    vmask = _mm256_or_si256(vmask, bit_mask);
    return _mm256_cmpeq_epi8(vmask, _mm256_set1_epi64x(-1));
}
```

Once I understood how that worked, I wondered whether I could expand the 32 bits into the msb of each byte in a different way. One difficulty here is that there is no `_mm256_sllv_epi8` ie. shift bytes left by a variable amount in each lane. After some gogling, it sounded like `mullo_epi16` could work and it did (as used in [Faster Base64 Encoding and Decoding Using AVX2 Instructions](https://arxiv.org/abs/1704.00605))! We still have to mask to isolate the msb but it was a fun exercise. I ended up writing multiple implementations (see [code](https://github.com/aconz2/hashpath-experiments/blob/19697ea166682849d72180a5c0ccd7514965450f/digest.c#L297)) with that concept but all of them are slower than the above one.

Note that the paper also uses `mulhi_epi16` (returns the upper 16 bits of the intermediate 32 bit product) to do a right shift:

```
16 bit value
msb-|                 |-lsb
    ponm_lkji hgfe_dcba

if we shift left by 15 == multiply by 2**15, the intermediate product is
    0pon_mlkj ihgf_edcb a000_0000 0000_0000

and then we take the high 16 bits, we get a right shift by 1
    0pon_mlkj ihgf_edcb

in general to get a k bit right shift, multiply by 2**(16-k)
because the hi 16 bits == dividing by 2**16
so we have 2**(16-k) / 2**16 == 2**(16-k-16) == 2**(-k) == divide by 2**k == right shift by k
```


# Alternate 40 byte format
This then lead me to thinking of another 40 byte format which doesn't require (but still benefits from) SIMD or pdep/pext. Without SIMD or pdep/pext it is close to the SIMD speed at 2.4/2.1 ns for encode/decode vs 1.9/1.8 ns with SIMD.

The idea is to grab the high bits of each byte (in groups of 8) and store them in the low nibble of 8 additional bytes at the end. As before, we set the msb of every byte to ensure it doesn't become `\0` or `/`.

```c
// this version grabs the msb of each 64 bit
// x = a b c d e f g h, i j k l m n o p, ...
// the first 64 bit value hgfedcba
// grab the msb h000_0000 g000_0000 f000_0000 e000_0000 d000_0000 c000_0000 b000_0000 a000_0000
// shift by 7           h         g         f         e         d         c         b         a  # puts to lsb
// next by 6           p         o         n         m         l         k         j         i
// etc. so that each low nibble gets the bits
// set the msb of these 8 bytes so that it can't be '\0' or '/'
// no simd or pdep/pext required
void encode_40_alt(const char x[32], char ret[40]) {
    uint64_t bits = 0;
    for (int i = 0; i < 4; i++) {
        uint64_t a;
        memcpy(&a, x + i * 8, 8);
        uint64_t msb = a & 0x8080808080808080;
        bits |= msb >> (7 - i);
        a |= 0x8080808080808080;
        memcpy(ret + i * 8, &a, 8);
    }
    bits |= 0x8080808080808080;
    memcpy(ret + 32, &bits, 8);
}

void decode_40_alt(const char x[40], char ret[32]) {
    uint64_t bits;
    memcpy(&bits, x + 32, 8);
    for (int i = 0; i < 4; i++) {
        uint64_t a;
        memcpy(&a, x + i * 8, 8);
        uint64_t msb = (bits << (7 - i)) & 0x8080808080808080;
        a = (a & 0x7f7f7f7f7f7f7f7f) | msb;
        memcpy(ret + i * 8, &a, 8);
    }
}
```

And in SIMD we can mask the high bits, shift right, then OR reduce to a single 8 byte value

```c
void encode_40_alt_simd(const char x[32], char ret[40]) {
    __m256i y = _mm256_loadu_si256((__m256i*) x);

    const __m256i shifts = _mm256_set_epi64x(4, 5, 6, 7); // maybe use a cvtepu8_epi64?
    __m256i z = _mm256_srlv_epi64(_mm256_and_si256(y, _mm256_set1_epi64x(0x8080808080808080)), shifts);
    // or reduce the 4 u64
    // clang chooses to do 1 shuf then an extractf128 then or
    // 3 2   1 0
    // d c | b a
    // c d | a b
    z = _mm256_or_si256(z, _mm256_permute4x64_epi64(z, 0b10110001));
    // dc dc | ba ba
    // ba ba | dc dc
    z = _mm256_or_si256(z, _mm256_permute4x64_epi64(z, 0b00001010));

    y = _mm256_or_si256(y, _mm256_set1_epi64x(0x8080808080808080));
    _mm256_storeu_si256((__m256i*)ret, y);

    uint64_t bits = _mm256_extract_epi64(z, 0);
    bits |= 0x8080808080808080;
    memcpy(ret + 32, &bits, 8);
}

void decode_40_alt_simd(const char x[40], char ret[32]) {
    __m256i y = _mm256_loadu_si256((__m256i*) x);

    uint64_t bits;
    memcpy(&bits, x + 32, 8);
    __m256i vbits = _mm256_set1_epi64x(bits);

    const __m256i shifts = _mm256_set_epi64x(4, 5, 6, 7); // maybe use a cvtepu8_epi64?
    vbits = _mm256_sllv_epi64(vbits, shifts);
    vbits = _mm256_and_si256(vbits, _mm256_set1_epi64x(0x8080808080808080));

    y = _mm256_and_si256(y, _mm256_set1_epi64x(0x7f7f7f7f7f7f7f7f));
    y = _mm256_or_si256(y, vbits);

    _mm256_storeu_si256((__m256i*)ret, y);
}
```

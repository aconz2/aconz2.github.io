---
layout: post
title:  "Hash Filenames"
date:   2026-01-08
categories:
---

I was looking into restic the other day and it uses a content addressed directory layout common to many programs. To store some blob, we compute a hash of the contents, transform it into a valid path, then write the contents into that path. This scheme also shows up in [git](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects), the [OCI disk image layout](https://specs.opencontainers.org/image-spec/image-layout/), I've used it in Program Explorer for caching of images, etc.

There are a few design choices that go into this scheme.

First, we have a choice of hash function. Git uses SHA1 which produces a 160 bit = 20 byte digest. Restic uses SHA2 which produces a 256 bit = 32 byte digest. OCI supports multiple hash functions which become part of the directory (see third point).

Second, we need to transform the raw bytes of our digest into a valid filename for our storage system. The common choice seems to be lowercase hex encoding which doubles the byte count. Other options would be base32, base64, etc. The validity of filenames depends on the kernel and filesystem the directory is located on.

Third, we may want to split our content addressed directory into sub-directories. For git, this means taking the first two characters of the hex encoded digest and using that as a directory name, followed by the remaining 38 hex characters as the file name; like `./{hex[:2]}/{hex[2:]}`. Closely related, restic uses the same directory of 2 chars, but uses the full digest for the filename like `./{hex[:2]}/{hex}`. OCI doesn't use the digest as a directory, but because it supports multiple hash functions, it uses the hash function name as a directory, then the full digest, like `{hashname}/{hex}`.

Using sub-directories is a good thing if we anticipate storing a lot of files. As the number of files grow, lookup times can increase inside the kernel because there are more entries in the directory. Splitting by leading parts of the hash gives good distribution and keeps directory sizes smaller at the expense of one extra directory lookup. I think this also helps with locking since we could modify two sub directories independently.

```
-- git --
./objects/1f/ef3d91b165f44e6e9e15a2405bab5c81a3a186
./objects/1f/039fc3320ce3a7d4283e676aeb9a327e9eaae3
./objects/48/0c2e614306c19c17d1b08d516b3766fea8cfff
./objects/48/06b39e0d135a77045652d7fe3c2adaaede0963

-- restic --
./config/data/21/2159dd48f8a24f33c307b750592773f8b71ff8d11452132a7b2e2a6a01611be1
./config/data/32/32ea976bc30771cebad8285cd99120ac8786f9ffd42141d452458089985043a5

-- OCI --
./blobs/sha256/3588d02542238316759cbf24502f4344ffcc8a60c803870022f335d1390c13b4
./blobs/sha256/4b0bc1c4050b03c95ef2a8e36e25feac42fd31283e8c30b3ee5df6b043155d3c
./blobs/sha256/7968321274dc6b6171697c33df7815310468e694ac5be0ec03ff053bb135e768
```

---

For a person who can obsess over tiny things that may or may not actually matter like myself, these schemes that use lowercase hex seem a bit wasteful. At least git doesn't repeat the first two chars, but it still doubles the filename from 19 bytes to 38 bytes. Longer filenames means storing fewer directory entries per page. So for whatever reason this morning it hit me that (at least on Linux with ext4/xfs/btrfs), we can replace each bad byte in the digest with a valid byte and then add 2 bits per byte at the end telling us whether the byte is valid, a slash, or a null.

Using SHA2 as an example, we get a 32 byte digest. For Linux we must not have byte values of `'\0'` or `'/'`. We add 2 bits per byte = 64 bits = 8 bytes at the end of our digest to record our replacements, giving us a total filename of 40 bytes (without peeling off the first byte). Anywhere in the digest which is 0 or 47 byte, we replace it with whatever value we like (except 0 or 47), lets say `0xfe`. Luckily we have 2 bits = 4 values to put our tristate of valid/slash/null so we can opt out of using the `0b00` value; otherwise we could run into a situation where we accidentally added a null byte at the end, thus invalidating our transform. And we can't accidentally add a slash byte because the high 2 bits of each of those bytes can't be `0b00` so it can't be slash.

```
Table of bits
00 - unused
01 - okay
10 - zero
11 - slash

example with 4 bytes
digest bytes: 35 47 55 00
-------------------------
valid       :  y  _  y  _
zero        :  _  _  _  y
slash       :  _  y  _  _

bits        : 01 11 01 10

filename    : 35 fe 55 fe bitconcat(01 11 01 10)
```

Peeling off the first byte of the digest is less favorable in this method because we would still need the full trailing byte.

How much space can this save? For SHA1 we shorten the filename from 38 chars to 25 (20 + 2 * 20 / 8) assuming no peeling. For SHA2 we go from 64 to 40 (32 + 2 * 32 / 8). A minimally informed guess of how this would effect a SHA2 layout on ext4 from the [docs](https://www.kernel.org/doc/html/latest/filesystems/ext4/directory.html) would be going from 56 entries per 4096 byte page to 85 entries per page, which is about 50% more.

I wrote an implementation which looks like:

```c
void encode(const uint8_t x[32], uint8_t ret[40]) {
    __m256i y = _mm256_loadu_si256((__m256i*) x);
    __m256i is_zero = _mm256_cmpeq_epi8(y, _mm256_set1_epi8(0));
    __m256i is_slash = _mm256_cmpeq_epi8(y, _mm256_set1_epi8('/'));
    __m256i is_zero_or_slash = _mm256_or_si256(is_zero, is_slash);

    y = _mm256_blendv_epi8(y, _mm256_set1_epi8(0xfe), is_zero_or_slash);
    _mm256_storeu_si256((__m256i*) ret, y);

    uint32_t mask_zero = _mm256_movemask_epi8(is_zero);
    uint32_t mask_slash = _mm256_movemask_epi8(is_slash);
    uint32_t mask_hi = mask_zero | mask_slash;
    uint32_t mask_lo = ~mask_zero;
    uint64_t mask = interleave(mask_lo, mask_hi);

    memcpy(ret + 32, &mask, 8);
}

void decode(const uint8_t x[40], uint8_t ret[32]) {
    uint64_t mask;
    memcpy(&mask, x + 32, 8);
    uint32_2 masks = deinterleave(mask);
    uint32_t mask_slash = masks.hi & masks.lo;
    uint32_t mask_zero = masks.hi & ~masks.lo;

    // TODO you can check the validity by checking that ~masks.hi & ~masks.lo is 0

    __m256i is_slash = expand_mask(mask_slash);
    __m256i is_zero = expand_mask(mask_zero);

    __m256i y = _mm256_loadu_si256((__m256i*) x);
    y = _mm256_blendv_epi8(y, _mm256_set1_epi8(0), is_zero);
    y = _mm256_blendv_epi8(y, _mm256_set1_epi8('/'), is_slash);
    _mm256_storeu_si256((__m256i*) ret, y);
}
```

We have to bit interleave the two masks so that we get 2 bits per byte which ensures we don't get null or slash bytes in the trailing 8 bytes. And then in `decode`, `expand_mask` inverts `_mm256_movemask_epi8` by spreading the bits back out into the top bits of each byte-lane (big thanks to [this SO answer](https://stackoverflow.com/questions/21622212/how-to-perform-the-inverse-of-mm256-movemask-epi8-vpmovmskb)). I used `pdep`/`pext` for interleave but not sure about other arch and perf.

Also note that the validity check for decoding is very fast as shown in the `TODO`. This is in contrast to checking the validity of decoding a hex string.

My basic perf testing (i7-7600U and 5950x) shows that `encode` is as fast as a simd hex encode and `decode` is 3-4x faster than a simd hex decode (both omitted validity check). And the hex encode/decode is specialized to 32 bytes so a general stdlib version is probably slower.

This scheme doesn't work in other scenarios like JSON or S3 or URLs (restic rest server uses `/blob/{hex digest}` for example). And it's not portable to other filesystems. And if you do any kind of shell scripting to list or delete these files you have to be extra careful to manage that properly (which is an ever present consideration that many people/programs ignore).

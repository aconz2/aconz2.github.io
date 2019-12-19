---
layout: post
title:  "Prime Factorization Sequence"
date:   2018-06-30
categories:
---

Here's a puzzler: can you write a program/formula to generate the sequence of powers that corresponds to the prime factorization of the natural numbers, in order?

Below is the prime factorization for the numbers up to 50, (a `.` represents a 0).

The tricky part is that the successor depends on addition, but you're dealing with multiplication.

Furthermore, I'm curious what the complexity of such a generator is: How many previous states does it need to remember (all, some, none)? Does it need to know the current number it's producing at all? Does it need to know the set of primes? Does it need to know how to multiply?

```
    47 43 41 37 31 29 23 19 17 13 11  7  5  3  2
 1)  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
 2)  .  .  .  .  .  .  .  .  .  .  .  .  .  .  1
 3)  .  .  .  .  .  .  .  .  .  .  .  .  .  1  .
 4)  .  .  .  .  .  .  .  .  .  .  .  .  .  .  2
 5)  .  .  .  .  .  .  .  .  .  .  .  .  1  .  .
 6)  .  .  .  .  .  .  .  .  .  .  .  .  .  1  1
 7)  .  .  .  .  .  .  .  .  .  .  .  1  .  .  .
 8)  .  .  .  .  .  .  .  .  .  .  .  .  .  .  3
 9)  .  .  .  .  .  .  .  .  .  .  .  .  .  2  .
10)  .  .  .  .  .  .  .  .  .  .  .  .  1  .  1
11)  .  .  .  .  .  .  .  .  .  .  1  .  .  .  .
12)  .  .  .  .  .  .  .  .  .  .  .  .  .  1  2
13)  .  .  .  .  .  .  .  .  .  1  .  .  .  .  .
14)  .  .  .  .  .  .  .  .  .  .  .  1  .  .  1
15)  .  .  .  .  .  .  .  .  .  .  .  .  1  1  .
16)  .  .  .  .  .  .  .  .  .  .  .  .  .  .  4
17)  .  .  .  .  .  .  .  .  1  .  .  .  .  .  .
18)  .  .  .  .  .  .  .  .  .  .  .  .  .  2  1
19)  .  .  .  .  .  .  .  1  .  .  .  .  .  .  .
20)  .  .  .  .  .  .  .  .  .  .  .  .  1  .  2
21)  .  .  .  .  .  .  .  .  .  .  .  1  .  1  .
22)  .  .  .  .  .  .  .  .  .  .  1  .  .  .  1
23)  .  .  .  .  .  .  1  .  .  .  .  .  .  .  .
24)  .  .  .  .  .  .  .  .  .  .  .  .  .  1  3
25)  .  .  .  .  .  .  .  .  .  .  .  .  2  .  .
26)  .  .  .  .  .  .  .  .  .  1  .  .  .  .  1
27)  .  .  .  .  .  .  .  .  .  .  .  .  .  3  .
28)  .  .  .  .  .  .  .  .  .  .  .  1  .  .  2
29)  .  .  .  .  .  1  .  .  .  .  .  .  .  .  .
30)  .  .  .  .  .  .  .  .  .  .  .  .  1  1  1
31)  .  .  .  .  1  .  .  .  .  .  .  .  .  .  .
32)  .  .  .  .  .  .  .  .  .  .  .  .  .  .  5
33)  .  .  .  .  .  .  .  .  .  .  1  .  .  1  .
34)  .  .  .  .  .  .  .  .  1  .  .  .  .  .  1
35)  .  .  .  .  .  .  .  .  .  .  .  1  1  .  .
36)  .  .  .  .  .  .  .  .  .  .  .  .  .  2  2
37)  .  .  .  1  .  .  .  .  .  .  .  .  .  .  .
38)  .  .  .  .  .  .  .  1  .  .  .  .  .  .  1
39)  .  .  .  .  .  .  .  .  .  1  .  .  .  1  .
40)  .  .  .  .  .  .  .  .  .  .  .  .  1  .  3
41)  .  .  1  .  .  .  .  .  .  .  .  .  .  .  .
42)  .  .  .  .  .  .  .  .  .  .  .  1  .  1  1
43)  .  1  .  .  .  .  .  .  .  .  .  .  .  .  .
44)  .  .  .  .  .  .  .  .  .  .  1  .  .  .  2
45)  .  .  .  .  .  .  .  .  .  .  .  .  1  2  .
46)  .  .  .  .  .  .  1  .  .  .  .  .  .  .  1
47)  1  .  .  .  .  .  .  .  .  .  .  .  .  .  .
48)  .  .  .  .  .  .  .  .  .  .  .  .  .  1  4
49)  .  .  .  .  .  .  .  .  .  .  .  2  .  .  .
```

Note: I've written the primes backwards just like we write least significant bits to the right in binary. This is also a bit misleading because prime factorization is the product-of-powers and not the sum-of-products like in a base `b` number scheme. I kept trying to do addition and figure out the carry scheme for a mixed base number scheme, but that's totally wrong.

The above is generated by:

```python
primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47][::-1]

def factor(x):
    for p in primes:
        i = 0
        while x % p == 0:
            i += 1
            x = x // p
        yield i

    assert x == 1, x

print('     ' + ' '.join(map('{:2}'.format, primes)))

for i in range(1, 50):
    exps = list(factor(i))
    print('{:3}) {}'.format(i, ' '.join(map('{:>2}'.format, ('.' if e == 0 else e for e in exps)))))
```
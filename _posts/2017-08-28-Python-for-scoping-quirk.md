---
layout: post
title:  "Python for scoping quirk"
date:   2017-08-28
categories:
---

I've come across a bug/quirk/annoyance/pitfall of the scoping of Python's `for`.

In this code:

```python
names = ['Alice', 'Bob']

for i, name in enumerate(names):
  print(f'{i} - {name}')

print(f'Printed {i} names')
```

`i` is in scope at the final `print`. This alone may constitue a surprise (it did for me the first time) and can lead to shadow bugs:

```python
name = 'Andrew'
names = ['Alice', 'Bob']
for name in names:
  print(name)
print(name)
```

Obviously contrived, but the last `print` prints `Bob` and not `Andrew`.

Back to our original example, this seems like a nice pattern because `i` will contain the number of loop iterations minus 1. This is nice if `names` were a generator and not a list.

But now the pain is real when your code tries to enumerate an empty list/generator/iterable:

```python
names = []

for i, name in enumerate(names):
  print(f'{i} - {name}')

print(f'Printed {i} names')
```

Errors out with `NameError: name 'i' is not defined`. Ouch!

You might expect `i` to be `0` in this case, but remember `i` will be # loops minus 1 so it would actually have to be `-1` for that to be true.

Going forward I'll probably stick to `len` on things which support it and using an explicit counter on general iterators. An explicit counter feels horrible, I know, but is less work (code & perf) than tee'ing and doing `sum(1 for _ in iterator)`

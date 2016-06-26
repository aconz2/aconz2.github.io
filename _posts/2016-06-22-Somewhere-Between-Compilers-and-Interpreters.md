---
layout: post
title:  "Somewhere Between Compilers and Interpreters"
date:   2016-06-22
categories:
---

Compilers and interpreters live on a continuum which is typically presented as a false dichotomy: you are either an interpreter or a compiler. This distinction loses sight of the bigger picture in taking a representation of a program and running it. I think there's also a large stigma between the two camps which prevents people from understanding what is really going on.

## The Big Picture

Why do we write programs? To take data representing a program and compute the algorithm it represents.

For completeness, this picture must include: you, the person writing the program; and the computer, the thing executing the program.

```
Person → Program → Computer → Output
```

Note: the above is not meant to convey types; just a flowchart like thing.

## "Compiler"

Here's my understanding of what people commonly use to distinguish a "compiler".

1. It outputs "raw" machine code
2. The code it generates is so much faster than interpreting the same program
3. Might have some type checking

## "Interpreter"

Here's my understanding of what people commonly use to distinguish an "interpreter".

1. They execute a program directly
2. They are slow

## A Computer *is* an Interpreter

If you haven't read much about how a [CPU](https://en.wikipedia.org/wiki/Central_processing_unit#Operation) operates, I'll quickly break it down as if you were a train tracks operator.

1. Fetch: retrieve the next instruction from memory ≍ read the next time slot from the schedule
2. Decode: change connections between components ≍ throw the levers to switch the tracks to the right position
3. Execute: let the ALU add, wait for memory, etc. ≍ let the trains go by, passengers get on/off, etc.

Now, if you've ever seen the code for an interpreter, it looks exactly like the above 3 steps (for example, [CPython](https://github.com/python/cpython/blob/master/Python/ceval.c#L1356) though you'll have to squint a bit between all the macros). The advantage of computer manufacturers implementing an interpreter in hardware is that it they can make it really fast. The disadvantage of computer manufacturers implementing an interpreter in hardware is that they've locked us in to only be able to use the instructions they've implemented. Luckily for us though, we know that with any computer we can simulate any other computer.

If a computer was *not* an interpreter, you would *not* be programming it and it would be a dumb chunk of digital logic which could compute some function, but not all (computable) functions.

## So what is a Compiler?

A compiler is a program which takes programs and outputs programs. The output of a compiler is then interpreted to produce a final result.

```
Person → (Program → Compiler → Program) → Computer → Output
```

You can see I've replaced `Program` from before with `Program → Compiler → Program` in parenthesis.

## So what is an Interpreter?

An interpreter is a program which takes programs and outputs the output of running that program.

```
Person → Program → (Interpreter → Computer) → Output
```

Here I've just replaced the `Computer` with `Interpreter → Computer` in parenthesis.

## Why I see no difference?

If you give me a compiler, I can make it into an interpreter by immediately running its output. For example:

```
interpret_c () { gcc $1 && exec a.out }
```

If you give me an interpreter, I can make it into a compiler by creating a new program which will later run that program. For example:

```
compile_python () { echo "#!/bin/sh \n python $1" > a.out && chmod +x a.out }
```

## "Transpilers"

This is an awful word coined to add differentiation between compilers which compile to native machine code and compilers which compile to another "human level language". For example, I could write a compiler from Scheme to OCaml and people would call this a transpiler.

In my experience, people usually use this word with derision like these are a lesser form of compiler. This is hilarious because machine code can be written by humans *and* it's interpreted by computer hardware. Or take any compiler which targets LLVM currently (of which there are many) and you may as well call those transpilers as well.

## JIT

JIT stands for "just in time". People usually refer to JIT in the context of interpreters which compile code "just in time"; ie. right before evaluating it. If you previously liked being in one of the two camps, you would now have trouble choosing where to place a "just in time compiling interpreter" (JITCI, which is a much more informative, though less pleasing acronym).

You could even consider the human process of invoking a compiler and then running the result a just in time compilation. While this may seem silly, it does call attention to the needs of a programmer, which typically involves many cycles of: edit, compile, run. A common reason to compile programs is that the resulting efficiency (time, space, etc.) can be better than interpreting (via software, not hardware). However, many programs we write are only run once! So why spend the time upfront to compile them? Lets look at a race:

```
Compiler
| Time to compile | Time to run |

Interpreter
|     Time to run     |
```

In this race, the interpreter won! But if we need to run a program millions of times, it is clear that even paying for a large upfront cost of compilation will win over an interpreter. Finally, there is some middle ground where we would like to execute the inner loop of some program a thousand times; a JITCI may compile *only* that inner loop to achieve a happy medium between the two.

This highlights the importance of not seeing the world as compilers vs interpreters, but as a spectrum (as is the case in just about everything in this world).

## Conclusions

If you walk up to me to have a conversation about compilers, will I be a pedant about it? Of course not; I know what you mean. But my point remains: a computer *is* an interpreter and pinning ourselves to a dichotomy is misinformed.

Ideally, we would like to have more knobs; knobs to tune the running of our program to best suit our needs, whether that's speed of compilation, speed of run-time, safety, security, space, etc. Compiler flags like `-O2` don't cut it for me because they are simply à la carte and don't provide anything beyond that. Where's the compiler flag for running the 16 hours I'm not working?

Interpreters can do some very cool things that compilers can't because they have more precise information than a compiler could guess about. For example, they can create an instance of your function which is specialized to the data you hand it. A compiler may do this for some things, but would quickly blow up your code size if it tried to accommodate every possible data type you might be handed over the network for instance.

And the fastest interpreter of them all is stuck in silicon. Perhaps we need hardware which can specialize itself based on the program it's currently running.

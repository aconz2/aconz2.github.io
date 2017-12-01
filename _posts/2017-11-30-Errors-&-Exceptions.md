---
layout: post
title:  "Errors & Exceptions"
date:   2017-11-30
categories:
---

I've been thinking a lot about errors lately and need to ramble for a bit.

The handful of teams (many are full-blown religions) I can name off the top of my head are:

  - Exceptions
    - Checked
    - Unchecked
  - Error/Either/Monad
  - Fail fast and let your supervisor restart
  - Error codes

All of these have different characteristics on the following axes:

## Performance

I'm not too concerned with this axis at the moment.

## Assurance

If you only have unchecked exceptions, you can't be sure whether or not and it what ways your calling code could potentially crash.

## Ease of propagation

Sometimes the program you're writing only cares about the happy path. Any error means the program should crash and somebody should handle it.

## Interface/program isolation

If you have any unchecked exceptions in your language, then interfaces cannot be held to a strict contract. You could do so with checked exceptions and have the layer right before you cross the interface boundary catch and rewrap any exception to maintain your contract.

## Information content

When an error occurs, how far away in the program do I learn about it. Can I interrogate for the local variables at that point in the program?

I think it's funny that even though C has the simplest error handling, it also supports post-mortem debugging through core dumps. The only downside (at least as far as I know) is that this approach is less amenable to program interrogation, even if its pretty good for human interaction. Compare this to say Python, which can capture all sorts of information in an exception object.

Even something like Maybe/Option doesn't always (depends on my mood that day) sit well with me because just getting an answer that I have None isn't super helpful. When did this value first become None? I think this is the whole point of Propagators (Sussman?). I know that you can use an Either-esque type to give some more detail, but combining them yadda yadda and the producer of the error must anticipate all needs of the consumer.

## OS-like-ness

Using an OS process, we can restart a process which dies unexpectedly. Depending on how the process dies or if it saves any information to the side before it dies (assuming it has the ability to do so), this may yield some or no useful information on how to act besides restart. This is the spirit of fail-fast approaches like Erlang; the benefit to pushing a mechanism like this into a language is that well, its in the language. You can achieve a similar thing with a top-level try...catch if you have exceptions.

## Know before you call

In a dependently typed language, we can imagine that any situation where you might have an error, like say parsing an integer from a string, you would first have a function which examines the string and verify that there is (or isn't) a parseable integer in the string. Only then could you call the parsing function and you would know for sure that it worked. This is both appealing and unsettling to me. Doing so moves the error handling from handling the output of the function to handling the input of the function. This makes the caller responsible and not the callee.

The reason I hesitate to dive into this is because verifying an input will be accepted by a function a) duplicates some logic of the code that could get out of sync b) duplicates some computation that you could have just used to get the answer. This is why I think of typical error handling like Exceptions or Either as the fusion of some code that does the right thing and handles the error. We have manually inlined the two computations because we don't know how to do so automatically.

Also, this falls down when dealing with external systems like a filesystem. If you require proof that a file exists in order to open it, then you have a race condition.

---
layout: post
title:  "On Identifiers"
date:   2018-02-11
categories:
---

An identifier in a program lets us refer to something by name. Often times, in an attempt to make the program easier to follow, we use identifiers which are compound words or other multi-word trains. Each programming language may have itsOwnRules AboutHowTo combine-different-words but_they_all serve the same purpose. Regardless of how you spell it, the identifier is supposed to be a human aid to understanding. The two things I want to look at for identifiers are variables and functions.

## Variables

I would wager that most people first see variables used in math class, like `f(x) = x + 2` where the variable `x` is a standin for some future value. But once we get past arithmetic, it can be more common to never bother substituting a value in there at all, it's just not the interesting bit. More often we play with the symbols themselves when doing things like factoring polynomials, taking derivatives, etc. And then finally, you get to your engineering degree and to be useful in the real world, you plug-and-chug (I can't remember which teacher introduced that phrase) to get the answer to your questions of this world.

Variables are not inherently about leaving a hole to be filled in, but become a thing unto themselves. This is made possible by using an identifier, like `x`, to give us a way to see and manipulate the variable. Anywhere we see `x`, we know that it represents the same value as any other `x` which lets us preform simplifications like `x + x + x = 3x`. And yet, we don't blink twice about doing something like `f(1) + f(2)`. The function definition `f` provides a context in which `x` is constant, but across multiple "invocations" of `f`, `x` is not necessarily constant. In programming, an "invocation" of a function gets a much more mechanical interpretation: allocate a stack frame / activation record, push the args, save the registers, jump to the function.

What has really been puzzling me is that inside a function, a variable is constant, but outside, it is... variable. Let's see what happens if we make a table. I will name the thing we know as a "variable", to "var" for clarity.

| Thing    | Inside   | Outside  |
|----------|----------|----------|
| var      | constant | variable |
| const    | constant | constant |
| ???????? | variable | variable |
| inter-var| variable | constant |

"const" is an easy one, we have just chosen a name for a value and they are inseparable. I propose we should use a hash of the value to derive names like this. Human names can always be layered on top.

"inter-var" is the name I am giving to an identifier which refers to an arbitrary implementation of an interface given by the name of the identifier. Like with const, we should use a hash of the interface laws to derive its identifier.

"????????" refers to something I don't know what it would be like yet.

I have some other quandaries regarding free variables, but that will get its own post.

## Functions

Programming languages let use name functions, which means we can use the name in place of the function. It also lets use re-use the identifier multiple times to avoid repeating the function verbatim at every use site. This leads to a compressed representation. In most languages, defining a function at the "top-level" means the function name is bound at the, well, top-level. To bring this back to variables from above, it is like immediately applying to an anonymous function (I think javascripters have an acronym for this):

```javascript
(function (f) {
    return f(1) + f(2);
})(function (x) {return x + 2;});
```

Given that this is the top-level, there is no "outside" for that identifier to be variable in. The vague point I am trying to find is that identifiers used in this way are pretty different than how we use "regular" variables. They are more like constants than variables, except when we consider a program over time, in which case they can vary.

## Conclusion

This is pretty wishy-washy stuff, but my main thought is that we use identifiers in programs to mean a variety of things. I think the most important thing would be to separate identifiers which are variable and identifiers which are constant. I think that functions currently fall in the mostly-constant identifier category but we see so many languages clawing towards a more variable approach with dependency injection, free monads, etc. that let us reinterpret a program under different circumstances.


## Extra

Most programs, barring some reflection tricks, should be equivalent to the same program with a (1-1 mapping from old to new identifiers & applied correctly wrt scoping rules) renaming of the identifiers. One of my goals is to reduce the amount of code in this world, so it seems like we should aim to choose a standardized naming scheme, like de-bruijn indices, and then layer human names on-top. Especially since two people may fancy different names for the same thing.

Lastly, C programs are surprisingly amenable to some of the ideas of dependency injection & free monads because of the linker. Inside a C compilation unit, the name you use is the name you get, but for symbols that are only declared, you can make many different executables each with different values for that symbol.

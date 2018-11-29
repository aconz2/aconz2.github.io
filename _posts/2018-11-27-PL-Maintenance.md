---
layout: post
title:  "PL Maintenance"
date:   2018-11-27
categories:
---

In light of recent events, I wanted to jot some thoughts down on open source development from a) the core PL side and b) the library side. The world is grappling with open source social contracts, code of conducts, monetary compensation etc for a while now but is increasingly tense/dire as software continues to grow. While I lament the fact that many issues are unavoidable social issues, I wouldn't be writing this if I didn't think there were some technical solutions that would make a PL flourish.

# Change + Breakage

We've all known for a long time that the hardest 80% of writing software is that your destination is a moving target and you can't rewrite your codebase every time you have new requirements. And in a typical case, you can't guarantee an atomic upgrade of all running code that may break tomorrow when you change something today.

For core developers, backwards compatibility is (hopefully) a primary concern when thinking about making changes. For library developers, they may be more focused on innovation and less on a long-lived stable library. In either case, we don't have PL's today that have laid out what compatibility is, how to detect when things would break, how to be robust to changes you can't control, and tooling that supports these goals.

The pain of maintenance of core+libraries is in the ratios: few maintainers to (presumably) many consumers. This makes for a messy situation when all consumers report a bug-fix, perf improvement, feature addition, etc. Instead of requiring manual review, we could be accepting help from consumers in a much more scalable way with the aid of tools that checked for compatibility etc. Take everything we know about CI, testing, compilers, and linters and keep running with it.

And beyond just accepting changes we know will be okay, we need to make it easier to fix changes that were not okay. Sometimes we make bad design choices and if we had better ways to handle large-scale changes, the cost of making the wrong choice is greatly reduced.

# Interfaces

We've all known for a long time that we should be coding to an interface and not an implementation, when it makes sense. However, you only have to look at the names of libraries to know that we haven't been heeding that advice. People choose mythical creatures, words from foreign languages, cutesy names that have cool logos all because they need a unique name for "what this library does". What does `flask` (python)? It does whatever `flask` does of course! What does `Neanderthal` (clojure) do? It does whatever `Neanderthal` does of course!

We shouldn't have libraries that implement the interface they define for themselves. This is part of what makes code brittle to change, because my application doesn't depend on "an http server", it depends on `flask`. And it's compounded when libraries depend on other libraries that are not swappable. You've now accrued a large dead weight that chains you to not just those libraries, but the people that maintain them!

I do think that a PL focused on interfaces from the ground up is the only way to get an ecosystem to follow suit. People can still have their own cute names (and I'd prefer a UUID at that) for their implementation of an interface -- which should have a reasonable name like "HTTP Server RFC 2616" or "GPU Math" -- but you won't be declaring your dependence on a cute name like that. Of course, interfaces may need to evolve, be fixed, etc. and need the same attention to change and breakage as above.

# Compensation

If I had my magical wish and all programs were written in a way where they import an interface (let's ignore any shortcuts or magic to specify which implementation you want), does that get rid of the problem of how to fairly compensate implementation developers for their time? Of course not.

This question is something that is still a bit of an unknown. I'd love for some sort of automatic payment system where when you run your code and it chooses implementation `X` written by Alice to satisfy interface `I`, then you pay some portion of Alice's fixed upkeep. This is like a strong vs weak scaling approach where instead of asking for a fixed amount of money from all consumers, you ask for 1 / upkeep amount of money that would give her a happy and secure life maintaining implementation `X` for years to come. Widespread software would become nearly free for the user, but provide a meaningful amount of money to fund its maintenance.

Let me reiterate that funding is not about paying to use software today, it's about paying to maintain it tomorrow.

# Security

The other recent event had to do with a hand-off in package ownership from one individual to another, whereby the new maintainer was malicious and had added some bad functionality to do something evil. It was then automatically installed as an update to existing users because it was semver compatible (or something... I've lost track of semver lock file shrinkwrap rigor mortis spells to pin but also allow bug fixes and security updates that are sometimes rootkits). There's two issues going on here:

## Signing Code

In a world where we import dependencies by implementation name, it'd be real nice if all code were signed. This could have at least alerted consumers of said library to see that a new key was signing the new code, and that even though the new key was signed with the old key (ie. this was a planned change-up) you might still want to review things.

## Language Sandboxing

BUT in bigger news, a library that adds a dependence for file-system access should be a big red flag (and the fact that it has default access to said file-system is another). If we were importing dependencies by interface, the new version would no longer satisfy the interface -- you cannot require more. However, this can be at odds with the abstraction that so long as the *resultant* thing satisfies the interface, then we should be happy. Otherwise, we have to know and/or wire-up every last dependency of the libraries we're using, even though we're saying we only care it satisfies this interface. If you coarsely partition the world into extra permissions that could actually matter -- like `filesystem`, `network`, `secrets store`, etc. -- then you could tag those as part of the interface and maybe arrive at a happy medium. You wouldn't end up with interfaces like `only uses 2Gb of memory and 100mW of power per function call`, but security wise it might be fine.

In other words, we want to import libraries that satisfy *at least* the required interface, but do so by using *at most* <blank>.

Another option would be more like effect handlers where the effect becomes part of the interface type and you even get the chance to intercept, inspect, interpret, etc. the calls to `read /my/diary` and the like.

# Summary

Today we import libraries that do whatever we need, but we never actually formalize what is we needed in the first place! `import requests` says I need whatever `requests` resolves to in my import path at the time that I'm running the program. Even in haskell when you import something, you take the type of whatever that name resolves to at the moment you build your project. I want to be able to refer to established interfaces by some unique identifier so we're using an unambiguous vocabulary, add some meaningful names like "Matrix Operations", and write a bit of code that works today, tomorrow, and the next without worrying about build paths, name conflicts, or whether github got pwned by Russia.

We need to sit down and agree on some interfaces, a sane way to limit/contain effects, and have tools to help those interfaces and their implementations evolve because we're surely going to get things wrong.

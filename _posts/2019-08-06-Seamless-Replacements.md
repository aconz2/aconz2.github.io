---
layout: post
title:  "Seamless Replacements"
date:   2019-08-06
categories:
---

Recently I made some small performance only modifications to a bioinformatics program called [gliph](https://github.com/aconz2/gliph). The details aren't important but the experience highlighted a few tricky things that I'd like to have good answers for in the future.

For the moment let's just imagine an executable that takes one file as an argument and writes output to standard out. You're interested in making some changes to the source (and you're not familiar with the source so you want to change as little as possible) such that:

1. The output is *semantically* equivalent
2. The diff/changes are easy to see
3. It is easy to verify the new version behaves *semantically* equivalent to the original tool
4. It is easy to do some benchmarking between the two to show you've accomplished your goal

## Getting a baseline

First issue right away: existing program didn't allow setting a seed. This means any kind of sampling, monte carlo, bayesian, shuffling, etc. aren't going to be the same between runs, so you're out of luck. Setting a seed can be a one-line diff in languages with a global rng and so you can be *pretty* sure that you're not introducing any changes. In this case, there was a seed dependent first step that saved its results to a file and afterwards, was deterministic to that file, so I just tested each version against that file.

The next thing to look out for when comparing outputs is iteration order of dict/hash/map etc. In this case, one thing the program outputs is a set partition. Each line of the output is one of the partitions, with the first field being the representative and the rest are the remaining elements of that partition. Since this information is built up in a dict/hash/map and then printed with `for key, value in dict/hash/map: print(key, value)`, the order of the output is arbitrary (language dependent, implementation dependent, you shouldn't rely on this).

## Comparing outputs

In an ideal world, all outputs would be canonical and you could verify two programs produced the same result by doing a bit-level comparison. However, because of the aforementioned issues around dict/hash/map iteration order, we just can't.

In this case, I wrote a simple program that compares output that is aware of the semantics of the output. I don't know who's to blame here, the text files, the programming languages, or what, but this is a PITA and shouldn't have to be done for every new program. The output should be saved with some indication that it is a `Map[String, Set[String]]` and we can automatically know how to semantically compare this (ie. order of entries doesn't matter, either in the key value pairs or in the order of the values).

## Where to make your changes

The easiest thing to do is to (assuming you're using version control) just start editing the file in place. But then you'll have a hard time making comparisons between the two because, unless you check out two worktrees, you don't have easy access to your old versions (Sidenote: I considered writing a tool like `git-exec-at-commit <commit> <args ...>` that would clone the repo at a commit in a tempdir and then exec the rest of the args; I didn't find anything online that does this).

In order to have easy access to both versions, I copied the original file, committed it, and then started making changes. This is better for the purpose of comparing the two, but is pretty ugly because the script/program has the name `blah-blah-faster` or `blah-blah-2` or whatever. And consumers of the tool have to opt-in (which is for the better in a lot of ways, but something I don't think is inherent) to the new version.

More generally, if you were doing this on the function level, you'd want to be able to:

1. Develop a new version/branch/implementation of a function without modification to the existing one
2. Verify functionality is equivalent (or bug is fixed or whatever)
3. Replace the old with the new and deprecate the old

## Takeaways

From this experience, I learned a bit of Perl and a taste for what could be a great addition to a new programming experience. I think this kind of thing should be the norm, but is currently very annoying. I think the best place to address this is at the language level. I'm not sure if you need special semantics for such a thing, but perhaps just a commitment from the tools, community, and ethos that 99% of the time you are *editing* programs that people have run, are running, and will want to run in the future.

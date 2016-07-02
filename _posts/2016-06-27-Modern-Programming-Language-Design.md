---
layout: post
title:  "Modern Programming Language Design"
date:   2016-07-02
categories:
---

The way we use computers today is a hilarious juxtaposition between the modern marvels of silicon engineering and monkeys hammering away on typewriters. I don't mean to say that those chip manufacturers are perfect or anything, but I think they've held up their end of the bargain with regular progress that no software could hope to claim for itself. I don't know what programmers have been doing all this time except for making larger balls of mud.

If we're all to make any significant progress in using computers more effectively, it needs to start at the language level. I do not see a language out there today which is suitable in my mind for really figuring out how to use all these computers around us in a more productive, safer, and efficient manner. Unfortunately, the programming world is a deeply entrenched group and we don't currently see enough incentives to drive industry-wide change.

There are only two incentives I see with the potential to drive widespread change in programming. The first is security which would rely on one of two scenarios:

1. The public wakes up and demands better security from their products after the millionth dox, passdump, identity theft etc.
2. Companies begin to lose more money from getting hacked etc. that it is finally cost effective to invest in security

(1) is questionable because people seem pretty content with how things are. (2) would only drive change when it gets to the point they can't just hire more goonies to "fix" their software. We could arguably add (3) to be a new market like IoT could drive security needs, but I think security is a limiting factor in its growth so the market isn't there yet. A possible (4) might be government regulation on software (FDA for programs anyone?) or professional associations (need a special degree to be a programmer!). I think those are interesting thought experiments, but I don't see them as realistic. And maybe (5) would be the government investing in cyber security, which they already do and I'm not hopeful for.

The other avenue would be increasing the productivity of a single programmer using a new language to the point where it's cheaper to invest in new technologies and employees who understand them than continue to hire more hands on deck. This is more aligned with the STEPS vision (if I understand correctly) and is what I ultimately think is the ideal route. Besides better software, I hope this might reign in the crazy programming job market and let people be free of current style of programming jobs; Yes, I would like to invent myself out of a job.

## Ten to One

Designing a language with the goal of replacing ten developers with one — hopefully 100, 1000, etc. — we run into important challenges beyond the usual semantic ones. Brief aside: this sounds a lot like VPRI's STEPS project which wanted to condense lines of code by orders of magnitude. I ask you to ponder the differences in condensing number of programmers vs size of program. For me, condensing programs has an unsatisfying endpoint because we know that if a program is maximally compressed, it will appear as random noise.

(Note: for the remainder of this post, I'd like you to imagine you're a programmer at a company with 9 other programmers. You come in on Monday morning and those 9 others all called in sick for the rest of the week. What are the things you need to carry your company forward?)

## Communication

First and foremost is communication. A lot of day-to-day programming effort involves human-to-human communication. Whether that's:

- reading an answer on StackOverflow
- reading a "specification" in the `man` pages or online docs
- reading the comments of source code
- asking a question on IRC or mailing list
- asking a coworker in person or on the phone

All of the above require human bandwidth to produce and consume (bye bye StackOverflow). I think this is a happy design constraint to have because it forces us to condense all necessary information to be readily available. Currently, these things are spread far and wide from the code, when they should really be inside them. And not I'm not just talking about more comments or docstrings; those should be nixed. I won't have time to manually update the English when I make changes. And the more people that use your software, the more bandwidth you'll have to devote to answering or providing documentation. This is simply not scalable for the future.

## Politics

Next comes politics. Without your 9 coworkers, you won't be able to debate the design of a new feature. In the time you used to spend in meetings discussing how to do things, you will now simply try each idea as it comes to you and decide which worked out the best. There's nowhere I see politics playing a greater role than in open source software, where the barrier to getting changes into master involve mile long conversations on issues. There won't be that many people to voice an opinion and so you will do what you think is best and reevaluate when the time comes.

## Versioning

This brings us to our next topic: versioning. Since you won't be debating changes on Github anymore (bye bye Github) but instead just making changes, we can't actually have you change any software. "Changing" a program just means you found a new one, but anyone referring to the old one shouldn't be effected (thank you Unison for showing me this idea). This has to be baked in at the language level because I won't have time to learn the 42 commands of another version control system. It also means no more installing, no more devops, no more containers and no more package managers. These are huge time sinks (closest we've come to a time machine!) that can get nixed with a language that unambiguously knows the answer to "Which function?" when you run a program. One more note to add is that the code for the function itself must also be verifiable as the correct answer to the question "Which function?".

## Naming

In the context of versioning, "Which function?" refers to resolving the difference of functionality (`foo_v1.0` vs `foo_v1.1`) we assign to the same name (`foo`). But in the more general context, "Which function?" bumps into the major difficulty created by naming things. Other places we typically see names in programs are things like nominal types and classes, struct/record field names, symbols, keywords, and namespaces. The most straightforward answer to the question "Which {function,type,etc}?" is "The one which is defined to be …". You may be uncomfortable without named fields or discriminated type unions without a named tag, but these are user interface design problems and should be solved as such. In fact, we may not even agree on a name suitable to use; I call the operator in the group of integers `plus` but you may want to call it `addition`. Currently, these discrepancies are resolved by politics when they should really not even be an issue.

## Dependencies

Without names, we can eliminate another huge (huge is a huge understatement — dealing with this crap is a job title!) pain point of our daily lives: dependency management. I could write for hours on how painful and shameful this problem is, but I'll keep it short. Ignoring our own sanity, a huge concern is the semi-computer-savoy scientist who wants to test a new {bioinformatics,computational chemistry,FEM,etc} tool but can't get the thing to install!! I don't know how many hours I've seen people lose who should be working on their research but have to trudge through the dance of how to get things working. This all comes back to naming. If I wrote a function and I wanted to send it to you to test out, it should be no harder than sending a 512 bit (or however long) hash. You take this, paste it into your REPL, hit <enter>, and it will transitively fetch all dependencies on IPFS. This is what deployment should look like today.

However, hashes are not ideal in the day-to-day of coding when you're changing lots of things and would actually prefer to use names, which is really a variable standing in for an actual value. That sounds a lot like abstraction: take a concrete value in an expression, replace it by a variable, and bind the variable to a function wrapping over that expression. Again, I think this is an area where we really need a user interface designer to address the usability of hashes as a layer on top of this base language.

## Security, Safety, & Correctness

I've written a bit about security before in another post and I think I came to the (semi)conclusion that capability based security is a good approach. I think this has a natural solution, where a function which wishes does operations on a file does not open that file, but simply takes the open file as a parameter. This smells a lot like dependency injection. The natural question then is, how does the caller open a file? Good question.

I think capabilities should permeate further into language design and let us write types like `(nat -> nat) which is total & bounded mem`. These sorts of claims are impossible to prove in the general case, but if my function doesn't need recursion or unbounded memory, why can't I write in a restricted subset of my language to permit these types of analyses? This permits us to do more upfront checking before running a program as opposed to running a nanny which has to watch our every move.

Safety falls near security and to me just means you have a sound type system. Programs should fail fast when they break.

Correctness is a doozy and is very complex. The only thing I'll say is that making a language amenable to sophisticated decision procedures about a program's behavior should be a consideration from the start. Anything not (currently or ever) provable without running the program entirely should be monitored by the runtime to verify it.

## NOS

NOS stands for "no operating system". Operating systems have tied us down to another platform, as if CPU instruction sets weren't enough of an anchor. I don't think we'll need operating systems forever and languages should not be designed to rely upon them forever. Whether we'll have so many cores a single chip that scheduling programs won't be an issue or that every function ever written will run on its own core and be networked together, something will take their place.

## Conclusion

Computers are not the same they were when C made its debut in 1972 and they certainly weren't used the same way either. We have enormous computing power at our disposal, yet we've failed to use it to make our programs do what we want. Error driven development is what we practice today and while I had never heard this phrase before I thought of it, a quick google search reveals many hits. Everything I read seems to put this in a good light, just like TDD and BDD (which both nonsense). But this is not something to be proud of. We should be writing programs that are correct by construction and the only kind of bugs are the ones where you the writer have made false assumptions.

The programming languages we use today are not fit for our modern needs where software is permeating all wakes of life. They have proven to be difficult to write, maintain, and reason about. These problems are exacerbated much faster than linearly with bigger programs and/or more people. Google is such a joke: all that computing power and all that man power and all they can do is sell ads? (That one is just to get you fired up!)

We cannot hope to achieve anything useful with computers if we do not reign in the way we program them. Software is exploding in diversity, but it should really be condensing. We need to be sharing our best code while cleaning out the garbage and not piling more code atop rotting bits. A single language will not rule the future and so — in the spirit of Racket — we need a programming language programming language.

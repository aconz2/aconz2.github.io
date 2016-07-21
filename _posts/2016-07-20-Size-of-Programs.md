---
layout: post
title:  "Size of Programs"
date:   2016-07-20
categories:
---

## Are our programs too small?

Whether it's code golfing or byte-counting Javascript libraries, programmers love to boast for the smallest code possible. I've certainly found myself scoffing at the size of downloading a Linux distro which can easily be a few GB's. Yet there are plenty of digital media we regularly consume which can be far bigger like pictures, music, and movies. These don't surprise me for how large they are because of the vast information they must store. So why is it our common reaction to think that programs can be so much smaller?

## Abstraction

The comparison I presented above is not entirely fair; perhaps a more direct comparison would be machine code compared to a movie. One reason a "high" level language can give us the impression of small program size is that pieces can be reused in the form of functions (or other abstraction utilities your language presents). This provides programs with something akin to a dictionary compression algorithm up front while still allowing humans to operate on this compressed form. In addition, a program written in language A gets all of the language A semantics for free without having to write them down every time. Taking the global view of a program + language + compiler provides us with a more direct comparison to a movie. Go read about Komolgorov complexity if you're interested in this view of incorporating all moving pieces into the analysis of information content.

## Interpreters

But what about if our program never gets compiled and is instead interpreted? This is perhaps in a different way a more direct comparison to a movie. A movie is a program which your movie player interprets. An interpreted language again gets to "hide" (reuse) information in the form of implementation details. Again, we should consider the interpreter + language + OS even to ensure we capture all information in our analysis, but a movie will probably come in as the heavyweight in this fight. 

## Behavior

When viewed as a program being executed by your movie player, a video is a very predictable program. We can very easily predict what it does in each frame (barring codec details). However, even the smallest of programs can be unpredictable and the only way to determine their behavior is to try running them and hope it finishes. How can it be that we can make less judgments about a smaller ball of information and be very confident about a huge ball of information?

In some ways, this does seem to make sense. A movie is a fully determined program and it takes a lot of information to encode its every move. Whereas the programs we tend to care about haven't been run with those arguments you just passed it before. It has to do the work of computation to determine what its every move is, like a curried movie.

(Perhaps a large piece which is being left out is the information encoded in the hardware being used to execute a program?)

## Should our programs be larger?

This has been on my mind lately while thinking about how we can be more sure of what our programs will do. Types add information to a program's information content which gives additional guarantees as to how it will behave. Dependent types extend these guarantees to a larger class while also increasing the complexity of the information added (is this trade-off of guarantee vs information linear?). In order to be confident with how our programs behave, how much more information do we need? This question is not really concerned with how much information a programmer might have to add because, for example, type inference adds guarantees whilst providing a means of compressing the information necessary to consume (as a user). Type inference is only the tip of what we may need as humans to be able to neatly view a program which contains far more information than current programs do. I say this with great enthusiasm and not with hesitation and screaming of "but how will I use Emacs to program like that?!?".

Programs are greatly under-specified today. This is fine when you don't know or don't care what it does in the other cases, but we have no smooth way of transitioning programs to higher levels of specificity when we do care. This means we need places to stick more information. Programming languages need places to put more information - lots more! I do not care if that information contributes to human proofs, machine proofs, run-time checks, linters, or whatever, but it needs to be machine consumable (ie. comments don't count) and it should be first class in the language. The existence of the word "debugging" is an existence proof of the information debt we face as programmers. The lack of information causes us to go chasing after where the problem might be when we should know who (which piece of code, not which coworker) to blame much more readily.

So I say: Bring on the gigabyte sized programs!!!

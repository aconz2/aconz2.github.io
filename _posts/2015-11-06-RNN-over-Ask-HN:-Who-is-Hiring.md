---
layout: post
title:  "RNN over 'Ask HN: Who is Hiring'"
date:   2015-11-06
categories:
---

The funniest thing I saw this week was this (excerpt from this
[gist](https://gist.github.com/nylki/1efbaa36635956d35bcc#file-neural-net-cooking-recipes-txt-L1490):

    Title: CINNAMON COOKIES ------------------------
     8 oz Piece of trout of milk (1 c.)
          Oil
          Sour cream
          -cut into 1/3 of the salt
     6    Cloves garlic, minced
     4    Small beef broth
          -deveined
          Salt & pepper
     3 c  Strawberry cooked rice
     1 ts Salt
     2 tb Cornstarch
     1 ts Salt
     2 c  Powdered sugar
     2 ts Ground coriander
    
    Preheat oven to 350. Place on lightly floured milk in skillet. Drain off each piece and
    remove from the warm water to coat. Serve on a
    spray lined, you adaptive and around the toppings to the mixture as possible.
    The coctunday recipe.  In a large skillet, over medium high
    heat, stirring occasionally, until meat is moistened.  Let rise
    approximately 4 minutes.
    
    Remove from heat and cook over moderately high heat for about 7 minutes.  In a small saucepan,
    covered, for 6 to 7 minutes, add corn in the oil.  Add the lemon juice
    and water in a double boiler or skillet. Spoon in the flour mixture
    to a boil. Drain the fruit.  PLACE STEW ONCOAT. WITH COOKIES
    WITH THE LOW THE PAN. PER SERVING: 77g; PRO: 4g; MC
    : From oven the chilies.

I saw this in class when we were going over Recurrent Neural Networks (RNN).
Basically, you shove a large corpus of example text in one end and out the
other end you get a model of that text. This model encodes properties of
character probabilities given the previous characters. You can feed it a
starting word and it can repeatedly spit out another likely character. I like
to imagine a monkey hammering away at a keyboard, kinda like this:

![Monkey Gif](http://gph.is/18Nr5Jy)

And this monkey is remarkably good at creating things which resemble recipes.
For a more in depth dive into RNNs, I highly reccommend
[this](http://karpathy.github.io/2015/05/21/rnn-effectiveness/) which is also
where I got the [implementation](https://github.com/karpathy/char-rnn) of what
I will use below.

## Ask HN: Who is Hiring? (\<Insert Month Here\>)

I found the recipes so hilarious that I had to make more of them. Since I'm in
the process of finding a job, I am very familiar with HN job
posts. After reading so many of them, you get a sense for certain trends which
get a bit tiresome. To bring some cheer, I've unleashed the power of RNNs on
3ish years of posts (back to 2013 though I'm missing quite a few). This,
yields roughly 13 million characters.

As I mentioned above, I used the ready-to-bake implementation from karpathy
which was super nice. It uses the [torch](https://torch.ch) framework which
actually has an Amazon EC2 Machine Image (AMI) ready-to-launch
[here](https://github.com/torch/torch7/wiki/Cheatsheet#ec2-public-ami) with all
the CUDA packages etc. This meant I was training my RNN in a few minutes on on
a g2.2xlarge which is 8 cores and a GPU with 4GB of memory. I trained a network
with 256 hidden nodes per layer with 3 hidden layers. This fit in only 500MB of
GPU memory. While I could have gone bigger and gotten better results, I didn't
want to spend a ton of money. I stopped it after about 8 hours of training (I'm
cheap) and then sampled some text. It's not as clean as I would have hoped, but
some of them are kinda funny. You can find the sampled output and the input
[here](https://gist.github.com/aconz2/66e1a0f5113e0f7665ae).

Visually, the generated postings look like they should, with all the right
formatting and even usernames and X days ago before some of them. Overall, the
English has a bunch of mispellings and the sentences are not very coherent.
Here's my favorite one:

    borts 277 days ago  

    GitHub - http://careers.stackoverflow.com/jobs/77213. New York City,
    Crypark and International Software Developer. Ramper healthcare in Santa
    Barbara, and MahoutOperaction (http://aclima.io) -
    http://smarkets.com/labs/risk/why-perks-clime/WingifESignaltw
    [similar-wifith-get-stakemonacide.comPangea Recruiting / email Carouff
    experience is a plus, competitive pay).Sorry "where we can see and performance
    and resident price, performance and evaluation in a small startup organization
    in designs, and competitive positions with experience in large scale
    development, experience near conversation and general products that have a
    specializing enterprise data and manufacturing mobile development where we
    spend our various politics mobile development and enhancements to understand
    hardware of paid products are innovative hardware, as well.  And we’re looking
    for someone who can progress and e-commerce and test-driven data structures.

    * Fulfilling systems and lead

    * * Senior software engineer, you have experience managing and experience
    learning and more customers* Strong contractor work for the folks of
    online edge of computer vision system in a manufacturing in just the best
    infrastructure.  More about you up and espons the team 

     *  

I'd like the revisit this when I have a personal machine with a GPU (or 2... or 3).

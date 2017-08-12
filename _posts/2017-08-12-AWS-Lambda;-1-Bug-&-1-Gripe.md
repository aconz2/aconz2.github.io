---
layout: post
title:  "AWS Lambda; 1 Bug & 1 Gripe"
date:   2017-08-12
categories:
---

Just wanted to make note of two things I came across recently while using AWS Lambda for a new project.

## Python 3.6 not perfect

I was very happy when I first heard that they were going to support Python 3.6 (Google App Engine time for you to get with the times!).

But...

I had a little application which was using `sqlite3` and that just doesn't work. Something about C extensions and yadda yadda. This is super annoying.

## Mysterious s3 hang

I spent a while tracking down a mysterious hang in my program. It would run and get stuck while fetching a file from s3.

The problem ended up being that my call to `s3.Object('bucket', 'key').download_file('/tmp/foobar')` was being run at import time. I happened (very luckily) across a post which mentioned something to this effect and was able to resolve it by moving that line into a functin and calling it from within the lambda handler.

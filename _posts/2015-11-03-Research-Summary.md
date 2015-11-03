---
layout: post
title:  "Research Summary"
date:   2015-11-03
categories:
---

Below is a quick summary of the work I've been doing in bioinformatics for my
undegraduate independent research project.

My research is focused on bioinformatics – the use of computational methods to
understand biological systems. In particular, I have been exploring ways to
estimate the abundance of DNA segments (genes or genomes) within biological
samples using high-throughput sequencing data. One application of this
information is the study of the effects of the abundance of a certain bacteria
on health or disease. Current methods for estimating abundances are either slow
or not generally applicable and my work has been focused on changing this
process through the use of k-mer counts (k-mers are substrings of DNA of length
k).

K-mer analysis begins by counting the frequency of distinct k-mers in a sample
of DNA and comparing these counts with k-mers found in a set of DNA fragments
(contigs) of interest. While there are tools which use k-mer counts to estimate
the abundance of genes in a particular sample, I have shown that they break
down in metagenomic contexts – samples collected from the environment
containing multiple organisms. Metagenomic samples contain many highly related
organisms which leads to the presence of spurious counts when looking at a
contig because of sequences originating from the related organisms (non-unique
k-mers). In an attempt to recover a clean signal, I tried multiple methods to
fit the distribution of observed counts to a statistical model as well as a
variety of signal processing techniques. However, after months of negative
results, my attention shifted to a novel application of k-mers: haplotype
separation.

For diploid (two chromosomes) organisms, a sequenced genome is a mixture of two
chromosomes (one from the mother and the other from the father). In order to
label the haplotype profiles of a mother terrapin's genome, we applied a k-mer
analysis based on 16 of its progeny. I wrote software to collect k-mer counts
from the 16 progeny and join them to create a k-mer presence/absence table.
Doing so with over 3 billion distinct k-mers involved massaging hash tables for
an efficient join as well as determining criteria for retaining an informative
subset of k-mers. In a collaboration with students from the University of
Tubingen, my software for labeling a sequence of DNA based on its consensus
haplotype profile was used to annotate over 60% of the terrapin genome. By
examining many samples, progeny in this case, k-mers give rise to a clearer
picture than any single sample could provide. With this insight, I refocused my
original k-mer analysis.

While abundance estimation using k-mer counts is still an open problem, one
application of these estimates from multiple samples is to separate or cluster
contigs based on the genome they originate from. This approach has been used
with read-mapping data for de novo metagenomic assemblies. Read mapping is slow
and involves an arbitrary choice of the “best” mapped location. I am currently
investigating the effects of replacing read-mapping data with k-mer counts. The
latter are much faster to compute and lead to a large efficiency gain when
examining hundreds of samples. Barring success with the existing clustering
algorithms, such as Gaussian mixture models and canopy, I will need to
investigate the performance of a new clustering approach which is more closely
aligned with the characteristics of k-mer counts. For example, even if the
k-mer counts do not fit a clean statistical model, two contigs which originate
from the same genome should have a low variance in the ratio of their counts.
This metric lends itself well to graph clustering with canopy pre-processing in
order to avoid computing distance metrics for all pairs.

Pending the success of this new approach, I will be able to explore the effect
of k-mer size as well as selecting a subset of informative k-mers, much like in
the haplotype project. K-mer size selection is not rigorously studied, but is
very important from an engineering perspective. For example, at k = 15, a 4
byte counter can be used for each k-mer in a contiguous array with direct
addressing (not storing keys) and still fit in a desktop's memory; at k = 20, a
sophisticated hash table must be used to fit the counts in a server's memory.
Research on the effect of k-mer size will enable further progress on previous
work I put on hold – compactly storing k-mer counts for multiple samples and an
exploration of whether approximate counts can be used (which can be computed
more efficiently). The impact of positive findings in my research would lead to
a space reduction of two orders of magnitude as compared to approaches that
rely on the raw reads.

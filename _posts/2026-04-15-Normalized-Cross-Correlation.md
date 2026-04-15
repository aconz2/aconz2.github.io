---
layout: post
title:  "Normalized Cross Correlation"
date:   2026-04-15
categories:
---

I spent some time recently on a tool to OCR images which have been rendered (ie. Print To PDF not photographs) with a known font. I call that tool [font-ocr](https://github.com/aconz2/font-ocr) or focr. Some fonts are particularly tricky with the difference between 1 (one) and lowercase l (letter el) like Courier or Courier New. So my approach was to take the known font, render each letter, and compare with the input image.

My first approach required the user to specify the starting coordinates, font size, line height, and line advance. Then we try rendering each character and comparing the pixelwise sum-of-squares distance and choose the letter that minimizes this distance and add it to our string. We then re-render the entire string with each possible next character and repeat for the whole line. The reason we re-render the entire string is because fonts are complicated and don't just render in an integer NxM perfect pixel rectangle. Rather they get rendered with sub-pixel precision (I think `26.6` fixed point is the standard, so 6 bits of fraction) then rasterized into a pixel grid. By re-rendering the entire string each time, we let the renderer (I use freetype) recreate the process that would have drawn our input image. The subpixel positions come into play in a single line of text from the advance, which is the distance we advance the imaginary pen after each letter. For monospace fonts, this advance is fixed, but for other fonts it is variable per letter (or sometimes per letter combination I think). There's also the possibility of extra kerning (distance between letters) that might be required to accurately reproduce the input, so I built that in because it was necessary in my first test. And it supports font hinting.

While this approach worked and was fast-enough, though algorithmically slow, it worked because the line advance was an integer so the user could specify one number and we can find the start of every line perfectly. However, when I tried it on some other images, they had neither a fixed subpixel line advance nor a fixed integer line advance, but some combination of the two. My best understanding of how this is generated is that something like Microsoft ClearType will snap the y position to an integer sometimes. So I needed another approach which lead me to template matching.

Template matching is a common computer vision task to search for a template (the thing we ware searching for) in an image by comparing it against every patch of the same size in that image (see [OpenCV for more](https://docs.opencv.org/4.13.0/d4/dc6/tutorial_py_template_matching.html)). In our case, that means rendering each letter with some number of subpixel-offsets in the x and y direction at a particular font size, then searching for each one in the image. For a typical font of size 12 this might give templates of size approximately 8x12 to 12x15 (not exact) and we don't expect much bigger templates. In a input image of size 816x1056 (8.5in x 11in at 96ppi) that means we have to compare about 100 pixels about 800K times or about 80M operations. And then repeat for every letter at every offset we specify. Because our requirements are fairly narrow, I thought I would try writing a specialized version.

This brings us to normalized cross correlation (NCC). When we compare our template to a patch, we need a number that tells us how close of a match it is. We also want this number to be in a fixed range so that we can specify a single threshold and have it be meaningful across templates of differing size. This is what NCC gives us, a number in [-1, 1] where 1 is a perfect match. NCC is really the cosine similarity of the mean centered and normalized patches. Its definition:

```
center = x - mean(x)
normalize(x) = x / norm(x)
NCC(x, y) = dot(normalize(center(x)), normalize(center(y)))
```

where we treat the template and patch as an unrolled 2d object into a 1d vector.

I started out with this definition and quickly ran into numerical issues from a) dot not returning in [-1, 1] because the vectors aren't exactly normalized b) for an all/mostly white/black patch (depending on convention) the norm is zero/tiny. And it's also really slow because a) it is floating point b) we have to get every pixel of the patch (from the image) to compute the mean, then subtract it which requires going over the patch again, then normalize which goes over the patch again, and finally dot which requires going over the patch again!

So next comes the google searching and a bit of LLM chat for a much better solution.

These two papers are a good reference, though I think my method is slightly different than either: [Fast Normalized Cross-Correlation](https://scribblethink.org/Work/nvisionInterface/nip.pdf) and [Template Matching using Fast Normalized Cross Correlation](https://isas.iar.kit.edu/pdf/SPIE01_BriechleHanebeck_CrossCorr.pdf).

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mrow>
    <mrow>
      <mi>NCC</mi>
      <mo>(</mo>
      <mi>x</mi>
      <mo>,</mo>
      <mi>y</mi>
      <mo>)</mo>
    </mrow>
    <mo>=</mo>
    <mfrac>
      <mrow>
        <munder>
          <mo>&Sigma;</mo>
          <mrow>
            <mi>i</mi>
          </mrow>
        </munder>
        <mrow>
          <mo>(</mo>
          <mrow>
            <msub>
              <mi>x</mi>
              <mi>i</mi>
            </msub>
            <mo>-</mo>
            <mover>
              <mi>x</mi>
              <mo>&macr;</mo>
            </mover>
          </mrow>
          <mo>)</mo>
        </mrow>
        <mrow>
          <mo>(</mo>
          <mrow>
            <msub>
              <mi>y</mi>
              <mi>i</mi>
            </msub>
            <mo>-</mo>
            <mover>
              <mi>y</mi>
              <mo>&macr;</mo>
            </mover>
          </mrow>
          <mo>)</mo>
        </mrow>
      </mrow>
      <mrow>
        <msqrt>
          <mrow>
            <munder>
              <mo>&Sigma;</mo>
              <mrow>
                <mi>i</mi>
              </mrow>
            </munder>
            <msup>
              <mrow>
                <mo>(</mo>
                <mrow>
                  <msub>
                    <mi>x</mi>
                    <mi>i</mi>
                  </msub>
                  <mo>-</mo>
                  <mover>
                    <mi>x</mi>
                    <mo>&macr;</mo>
                  </mover>
                </mrow>
                <mo>)</mo>
              </mrow>
              <mn>2</mn>
            </msup>
          </mrow>
        </msqrt>
        <mo>&#x2062;</mo>
        <msqrt>
          <mrow>
            <munder>
              <mo>&Sigma;</mo>
              <mrow>
                <mi>i</mi>
              </mrow>
            </munder>
            <msup>
              <mrow>
                <mo>(</mo>
                <mrow>
                  <msub>
                    <mi>y</mi>
                    <mi>i</mi>
                  </msub>
                  <mo>-</mo>
                  <mover>
                    <mi>y</mi>
                    <mo>&macr;</mo>
                  </mover>
                </mrow>
                <mo>)</mo>
              </mrow>
              <mn>2</mn>
            </msup>
          </mrow>
        </msqrt>
      </mrow>
    </mfrac>
  </mrow>
</math>

Starting at the numerator, we expand the product:

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mrow>
    <mi>num</mi>
    <mo>=</mo>
    <munder>
      <mo>&Sigma;</mo>
      <mrow>
        <mi>i</mi>
      </mrow>
    </munder>
    <mrow>
      <mo>(</mo>
      <mrow>
        <msub>
          <mi>x</mi>
          <mi>i</mi>
        </msub>
        <msub>
          <mi>y</mi>
          <mi>i</mi>
        </msub>
        <mo>-</mo>
        <msub>
          <mi>x</mi>
          <mi>i</mi>
        </msub>
        <mover>
          <mi>y</mi>
          <mo>&macr;</mo>
        </mover>
        <mo>-</mo>
        <mover>
          <mi>x</mi>
          <mo>&macr;</mo>
        </mover>
        <msub>
          <mi>y</mi>
          <mi>i</mi>
        </msub>
        <mo>+</mo>
        <mover>
          <mi>x</mi>
          <mo>&macr;</mo>
        </mover>
        <mover>
          <mi>y</mi>
          <mo>&macr;</mo>
        </mover>
      </mrow>
      <mo>)</mo>
    </mrow>
  </mrow>
</math>

then distribute the summation and replace with the substitutions

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mrow>
    <msub>
      <mi>S</mi>
      <mi>x</mi>
    </msub>
    <mo>=</mo>
    <munder>
      <mo>&Sigma;</mo>
      <mrow>
        <mi>i</mi>
      </mrow>
    </munder>
    <msub>
      <mi>x</mi>
      <mi>i</mi>
    </msub>
  </mrow>
</math>

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mrow>
    <msub>
      <mi>S</mi>
      <mi>y</mi>
    </msub>
    <mo>=</mo>
    <munder>
      <mo>&Sigma;</mo>
      <mrow>
        <mi>i</mi>
      </mrow>
    </munder>
    <msub>
      <mi>y</mi>
      <mi>i</mi>
    </msub>
  </mrow>
</math>

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mrow>
    <msub>
      <mi>S</mi>
      <mi>xy</mi>
    </msub>
    <mo>=</mo>
    <munder>
      <mo>&Sigma;</mo>
      <mrow>
        <mi>i</mi>
      </mrow>
    </munder>
    <msub>
      <mi>x</mi>
      <mi>i</mi>
    </msub>
    <msub>
      <mi>y</mi>
      <mi>i</mi>
    </msub>
  </mrow>
</math>

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mrow>
    <mover>
      <mi>x</mi>
      <mo>&macr;</mo>
    </mover>
    <mo>=</mo>
    <mfrac>
      <msub>
        <mi>S</mi>
        <mi>x</mi>
      </msub>
      <mi>n</mi>
    </mfrac>
  </mrow>
</math>
<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mrow>
    <mover>
      <mi>y</mi>
      <mo>&macr;</mo>
    </mover>
    <mo>=</mo>
    <mfrac>
      <msub>
        <mi>S</mi>
        <mi>y</mi>
      </msub>
      <mi>n</mi>
    </mfrac>
  </mrow>
</math>

we get

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mi>num</mi>
  <mo>=</mo>
  <msub>
    <mi>S</mi>
    <mi>xy</mi>
  </msub>
  <mo>-</mo>
  <msub>
    <mi>S</mi>
    <mi>x</mi>
  </msub>
  <mfrac>
    <msub>
      <mi>S</mi>
      <mi>y</mi>
    </msub>
    <mi>n</mi>
  </mfrac>
  <mo>-</mo>
  <mfrac>
    <msub>
      <mi>S</mi>
      <mi>x</mi>
    </msub>
    <mi>n</mi>
  </mfrac>
  <msub>
    <mi>S</mi>
    <mi>y</mi>
  </msub>
  <mo>+</mo>
  <mi>n</mi>
  <mfrac>
    <msub>
      <mi>S</mi>
      <mi>x</mi>
    </msub>
    <mi>n</mi>
  </mfrac>
  <mfrac>
    <msub>
      <mi>S</mi>
      <mi>y</mi>
    </msub>
    <mi>n</mi>
  </mfrac>
</math>

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mo>=</mo>
  <msub>
    <mi>S</mi>
    <mi>xy</mi>
  </msub>
  <mo>-</mo>
  <mfrac>
    <mrow>
      <msub>
        <mi>S</mi>
        <mi>x</mi>
      </msub>
      <msub>
        <mi>S</mi>
        <mi>y</mi>
      </msub>
    </mrow>
    <mi>n</mi>
  </mfrac>
</math>

and likewise the norm of the mean centered vector (ie. the standard deviation) from the denominator can likewise be written as:

<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">
  <mi>den</mi>
  <mo>=</mo>
  <mo>(</mo>
  <msub>
    <mi>S</mi>
    <msup>
      <mi>x</mi>
      <mn>2</mn>
    </msup>
  </msub>
  <mo>-</mo>
  <mfrac>
    <msup>
      <mrow>
        <mo>(</mo>
        <msub>
          <mi>S</mi>
          <mi>x</mi>
        </msub>
        <mo>)</mo>
      </mrow>
      <mn>2</mn>
    </msup>
    <mi>n</mi>
  </mfrac>
  <mo>)</mo>
  <mo>(</mo>
  <msub>
    <mi>S</mi>
    <msup>
      <mi>y</mi>
      <mn>2</mn>
    </msup>
  </msub>
  <mo>-</mo>
  <mfrac>
    <msup>
      <mrow>
        <mo>(</mo>
        <msub>
          <mi>S</mi>
          <mi>y</mi>
        </msub>
        <mo>)</mo>
      </mrow>
      <mn>2</mn>
    </msup>
    <mi>n</mi>
  </mfrac>
  <mo>)</mo>
</math>

with the parens there to clarify the difference between the sum of squares and the square of sum.

The first paper shows how to calculate the patch sum and sum of squares from tables in a dynamic programming fashion. Much like in 1d we can compute the running sum of an array and then get the sum of any interval by subtracting the running sum on either end, it does that in 2d. So we compute these running sum and square sum tables once, then for a given patch size, we compute the patch sum and patch norm (using the eqn above) for every patch and store them in a table. We can re-use these tables if we are searching multiple templates of the same size sequentially.

Armed with this reformulation, we can compute the NCC mostly in the 8 bit integer domain and only do floating point at the very end. The only thing we need to do per patch is compute the dot product (`Sxy`) which we can safely accumulate in a 32 bit integer for 8 bit pixels for patches easily up to total size 1000 (256 * 256 * 1000 is 26 bits so we have plenty of headroom).



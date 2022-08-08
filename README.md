# layman

### Introduction
**_layman_** is a constraint layout library for html pages. 

Some example pages designed using `layman` can be [found here](https://gbenroscience.github.io/layman/easylogin.html)
and [also here](https://gbenroscience.github.io/layman/profile.html)

**_layman_** is an offshoot of **_layit_** (by the same author) and uses basically the same layout engine as **_layit_**.

What problem does **_layman_** solve?


**_layman_** allows the user to work directly with their own html pages and constrain the elements to their heart's content without having to create additional xml files, or having to learn the syntax of android xml.
In **_layman_**, no new xml files are created.


#### NOTE:
`layman.js` includes a merge of original project files with the following files(**with attribution)**,

### 1. [ResizeSensor from marcj/css-element-queries](https://github.com/marcj/css-element-queries/)
### 2. [Autolayout from lume/autolayout](https://github.com/lume/autolayout)
### 3. [ULID from ulid/javascript](https://github.com/ulid/javascript)



### How to use
Download the `layman.js` file and add the script in the head section of your html page
page...e.g.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Title</title>
    <script src="layman.js"></script>
</head>
<body>
</body>
</html>
```

All **_layman.js_** needs to work with your html layouts are three data attributes.

1. **data-const** _This attribute is used to specify the constraints on the html element._
2. **data-guide** _Specifies that the html element is to be used as a Guideline for other html elements._
3. **data-guide-color** _Specifies if guidelines should be visible and what color they should have. This can be very useful for debugging._

## NOTE: The `data-guide-color` must be specified on the body tag alone. It applies to the whole page.

**For example:**


```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Title</title>
    <script src="layman.js"></script>
</head>
<body data-guide-color="#f00">
</body>
</html>
```
If `data-guide-color` is absent on the `body` tag, then all Guidelines are rendered using a transparent color and hidden, just in case... lol.
### Dive deeper into data-const


#### Syntax

```html
<div id="some-div" data-const="w:100px, h:150px, ss:parent, tt: parent"></div>
```

### Layout Construction & Syntax in more detail
The syntax of the constraint definitions is similar to how 
Android's xml constraints work.
For convenience and to reduce verbosity, the constraint properties with long names have been renamed to shorter forms. This allows for quicker typing also. See below:

```
    layout_constraintTop_toTopOf       -> tt
    layout_constraintBottom_toBottomOf -> bb
    layout_constraintStart_toStartOf   -> ss
    layout_constraintEnd_toEndOf       -> ee
    layout_constraintTop_toBottomOf    -> tb
    layout_constraintStart_toEndOf     -> se
    layout_constraintEnd_toStartOf     -> es
    layout_constraintBottom_toTopOf    -> bt
    layout_constraintCenterXAlign      -> cx
    layout_constraintCenterYAlign      -> cy
    layout_constraintDimensionRatio    -> dim_ratio
    layout_constraintGuide_percent     -> guide-pct(in %)
    layout_constraintGuide_begin     -> guide-begin(in px or no units)
    layout_constraintGuide_end     -> guide-end(in px or no units)
```

#### w and h

These properties are used to specify the size of the view.
Here are perfectly valid ways to specify the width of a view:
```
1. w:80px  //sets the width in pixels
2. w:50%   // sets the width as a percentage of its parent's width
3. w:80    //sets the width in pixels
4. w:height // sets the view's width to be same as its height
5. w:height*0.5 //sets the view's width to be half of its height
6. w:0.5*height //sets the view's width to be half of its height
7. w:some_id // sets the view's width to be same as that of the view whose id is `some_id`
8. w:some_id.width // sets the view's width to be same as that of the view whose id is `some_id`
9. w:some_id.height // sets the view's width to be same as the height of the view whose id is `some_id`
10. w:0.8*some_id // sets the view's width to be 0.8 times the width of `some_id`
11. w:0.3*some_id.width// sets the view's width to be 0.3 times the width of `some_id`
12. w:0.8*some_id.height// sets the view's width to be 0.8 times the height of `some_id`
13. w:some_id.width*0.3// sets the view's width to be 0.3 times the width of `some_id`
14. w:some_id.height*0.8// sets the view's width to be 0.8 times the height of `some_id`
15. w:12+height // sets the view's width to be 12 plus its own height
16. w:height+20 // sets the view's width to be 20 plus its own height
17. w:height-12 // sets the view's width to be its own height minus 12
18. w:96+some_id.width// sets the view's width to be 96 pixels plus the width of `some_id`
19. w:32+some_id.height// sets the view's width to be 32 pixels plus the height of `some_id`
20. w:some_id.width+120// sets the view's width to be 120 pixels plus the width of `some_id`
21. w:some_id.height+32// sets the view's width to be 32 pixels plus the height of `some_id`
22. w:some_id.width-120// sets the view's width to be the width of `some_id` minus 120 pixels
23. w:some_id.height-32// sets the view's width to be the height of `some_id` minus 120 pixels
```
These same rules apply to the height also. Note that division operation is not supported, only multiplication, addition and subtraction.

Be careful not to use values which have not been initialized.
e.g.
`w:height` is correct, but
`w:width+20` is wrong

Also make sure that `some_id` is a different view from the one whose size we are setting or if it is the same view,
then it should refer to the other dimension.
For example, if the view whose size we are setting is `phone_label`, You may do:
`w:phone_label.height`
but not:
`w:phone_label.width` or `w:phone_label.width*2` or something similar.

If you are setting the width in terms of the height or the height in terms of the width, then ensure that you have properly
defined the value of the other dimension e.g.

`w:height`<br>
`h:90px`<br>

OR

`w:height`<br>
`h:some_id`<br>

All these relationships help to define aspect ratios and more complicated relationships that give developers flexibility in building UI.

`w:match_parent` and `h:'match_parent` are supported.
`w:wrap_content` and `h:'wrap_content` are only partially supported.
The implementation is not yet complete as regards these, for various reasons.

The underlying `autolayout.js` library does not seem to support `wrap_content`,so we are trying to provide some implementation for it.

Note that where no units are specified, pixels are used. So `w:200` and `w:200px` are equivalent.
All these apply to `height` also.<br>
**CSS calc operations are not supported**<br>

#### maxW, maxH, minW, minH
These refer to the maximum width and maximum height, minimum width and minimum height
These are all supported.

#### m
Refers to the  margin around the element

#### mv and mh
Refer to the vertical (top and bottom) and horizontal margins around the html element

#### ms and me, mt and mb
Refer to the start(left) margin, the end(right) margin,  and the top and bottom margins around the html element

The units supported for margins are pixels and percentages.
If no units are supplied, pixels are assumed.


#### cx and cy

Allows a view's center to be constrained horizontally or vertically to another view's center.<br>
The values accepted are either, `parent` or `view_id`; where `view_id` is the id of the view we are constraining this view with respect to.

#### orient
This is used when the data-guide attribute is set also on this html element;which means the
element is a guideline for other elements.
It specifies whether the Guideline is an horizontal or a vertical guideline.
Accepted values are `vertical` or `horizontal`

#### guide-pct
This is used when the data-guide attribute is set also on this html element.
It specifies the distance (in percentages or decimal fractions) of a horizontal Guideline from the top of its parent
and the distance (in percentages or decimal fractions) of a vertical Guideline from the left of its parent
You may set it as such: `guide-pct: 65%` or `guide-pct: 0.65`, both statements are equivalent.

#### guide-begin
This is used when the data-guide attribute is set also on this html element.
It specifies the distance in pixels of a horizontal Guideline from the top of its parent
and the distance in pixels of a vertical Guideline from the left of its parent
You may set it as such: `guide-begin: 65px` or `guide-begin: 65`

#### guide-end
This is used when the data-guide attribute is set also on this html element.
It specifies the distance in pixels of a horizontal Guideline from the bottom of its parent
and the distance in pixels of a vertical Guideline from the right of its parent.<br>
You may set it as such: `guide-end: 65px` or `guide-end: 65`


### Priorities

Just as the ideas for the constraints, `(ss, se, ee, es, tt, tb, bb, bt, cx, cy)`, were borrowed
from Android ConstraintLayout's xml, we have borrowed the idea of `priorities`
from iOS AutoLayout. The `priority` is a number that tells the layout engine how important that constraint is.

So when designing some layouts, you may specify the priority of the constraints, by ending it with
`@priority_value`.
<br> For example:
```html
<div>
<input id="phone_input" data-const="w:wrap_content, h: 42px, ss: parent, tt: parent, ms: 10, mt: 10">
<input id="password_input" data-const="w: phone_input, h: wrap_content, ss: phone_input@750, tb: phone_input">
</div>
```


### Examples

Below is the source code of a simple example login interface which you can
[view here](https://gbenroscience.github.io/layman/easylogin.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Easy Login</title>

    <style>
        body {
            background-color: #444E5D;
        }
        div#div1 {
            background-color: #4E5765;
            border-radius: 8px;
        }
        span {
            color: wheat;
            font-weight: bold;
            font-size: 1.5em;
        }
        input[type="email"], input[type="password"] {
            padding: 12px;
        }
        input[type="button"] {
            font-weight: bold;
            background-color: #4EA95F;
            border: none;
            border-radius: 6px;
        }
        input[type="button"]:hover {
            cursor: pointer;
            background-color: #2AA95F;
        }
        input[type="button"]:active {
            cursor: pointer;
            background-color: #2A765F;
        }
        a {
            color: white;
            text-decoration: none;
        }
        a:hover {
            color: chartreuse;
            text-decoration: underline;
        }
        a:visited {
            color: lightgray;
            text-decoration: underline;
        }
    </style>
    <script src="layman.js"></script>
</head>
<body data-guide-color="#fff">

<div id="div1" data-const="w: 30%, h:width, ms:0px, mt:0px, cx: parent, cy: parent">
    <span id="p1"
          data-const="w: wrap_content, h:wrap_content, cx: parent, tt: parent, mt: 24px">
        LOGIN
    </span>
    <img id="login-icon" src="img.png" data-const="w:96px, h:width, tb:p1, bt: fullname, cx: parent">
    <input id="fullname" type="email" placeholder="Enter your email address..."
           data-const="w:76%, h: wrap_content, cx: parent, cy: parent">
    <input id="pwd" type="password" placeholder="Please input password..."
           data-const="w:fullname, h: fullname, cx: parent, tb: fullname, mt: 12px">
    <input id="btn" type="button" tabindex="1" value="PROCEED"
           data-const="w:0.75*fullname, h: fullname, cx: parent, tb: pwd, mt: 18px">
    <a href="https://www.linkedin.com" id="link"
       data-const="w: wrap_content, h:wrap_content, cx: parent, tb: btn, mt: 12px">
        Forgot password?
    </a>
</div>
</body>
</html>
```
Another example can [be seen here](https://gbenroscience.github.io/layman/profile.html)

### `**onLayoutComplete**` 
In case one needs to run some code after the layout is done, put your code within the `onLayoutComplete` function.


# layman

### Introduction

**_layman_** is a constraint layout library for html pages.

Client side includes, popups, side menus and more design goodies(lol)

Here are some example pages designed using `layman`:

1. [A simple login page](https://gbenroscience.github.io/layman/easylogin.html) and
2. [A simple data collection page](https://gbenroscience.github.io/layman/profile.html)
3. [An example showing how to trigger the onLayoutComplete function](https://gbenroscience.github.io/layman/onlayout.html)
4. [And finally, a simple calculator](https://gbenroscience.github.io/layman/calc.html)

**_layman_** is an offshoot of **_layit_** (by the same author) and uses basically the same layout engine as **_layit_**. NOTE: layit has been discontinued and is now offline.

What problem does **_layman_** solve?

**_layman_** allows the user to work directly with their own html pages and constrain the elements to their heart's
content without having to create additional xml files, or having to learn the syntax of android xml.
In **_layman_**, no new xml files are created.

 

Modular design has also been added, with the addition of client-side includes for `tags > 0.1.1`.

### DO NOT USE
For now, `layman` has banned the use of hyphens in id names... e.g
```html
<p id="open-menu"></p>
``` 
or 

```html
<div id="my-nice-div"></div>
```


#### NOTE:

`layman.js` includes a merge of original project files with the following files(**with attribution)**,

### 1. [ResizeSensor from marcj/css-element-queries](https://github.com/marcj/css-element-queries/)

### 2. [Autolayout from lume/autolayout](https://github.com/lume/autolayout)

### 3. [ULID from ulid/javascript](https://github.com/ulid/javascript)



### NOTE:

We have added with the latest commits:

A. Support for:

<ol>
<li>w:num1%+num2 e.g w: 32%+18 width is 32% that of parent plus 18 pixels
</li>
<li> w:num1+num2% e.g w: 32+18% width is 18 pixels plus 32% that of parent </li>
<li> w:num1%-num2 e.g w: 32%-18 width is 32% that of parent minus 18 pixels</li>
<li> w:num1-num2% e.g w: 32-18% width is 32 pixels minus 18% that of parent </li>
<li> h:num1%+num2 e.g h: 32%+18 height is 32% that of parent plus 18 pixels</li>
<li> h:num1+num2% e.g h: 32+18% height is 18 pixels plus 32% that of parent </li>
<li> h:num1%-num2 e.g h: 32%-18 height is 32% that of parent minus 18 pixels</li>
<li>  h:num1-num2% e.g h: 32-18% height is 32 pixels minus 18% that of parent </li>
</ol>

This allows developers to add and subtract pixels from percentages and vice versa when assigning values to the width and heights of elements.

B. Due to the nature of the text elements in html, the wrap_content spec is not well supported, but we have a component called the LABEL in layman, which supports multi-line text. This is the layman.js standard for working with `wrap_content` specs when it comes to text rendering. It has been included several commits ago.
To use it, define it as a canvas. e.g:
```html
 <canvas id="page_title">Page Title</canvas> 
 ```
 Then in your layouts, do:

 ```Javascript
 
layoutCode = function () {
	return {
		body: {

		},

		elements: {
			...etc,
			"page_title": {
				w: "150px", h: "wrap_content", ss: "parent", tt: "parent", "dim-ratio": "11:4", ms: 8, mt: 24,
				"mi-gravity": "left",
				"mi-fg": "black",
				"mi-bg": "transparent",
				"mi-font-st": "normal",
				"mi-font-nm": "Arial",
				"mi-font-wt": "bold",
				"mi-font-sz": "1.2em",
				"mi-text": "Page Title",
				"mi-line-spacing": 15,
				"custom-widget": "label"
			},...etc
		}
	};
};
 ```
 In the latest commits, we have included the ability to set text in ```Label```.
 To do this for the `page_title` above, just do:
 ```Javascript
 	const label = page.getNodeWrapperById("page_title");
	label.setText(text);
 ```

 There are many other optimizations that we have released into the wild with the latest commits.

### How to use

Download the `layman.js` file or its minified version and add the script in the head section of your html page e.g.

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
3. **data-guide-color** _Specifies if guidelines should be visible and what color they should have. This can be very
   useful for debugging._

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

If `data-guide-color` is absent on the `body` tag, then all Guidelines are rendered using a transparent color and
hidden, just in case... lol.

### Dive deeper into data-const

#### Syntax

```html

<div id="some-div" data-const="w:100px; h:150px; ss:parent; tt: parent;"></div>
```

### Layout Construction & Syntax in more detail

The syntax of the constraint definitions is similar to how
Android's xml constraints work.
For convenience and to reduce verbosity, the constraint properties with long names have been renamed to shorter forms.
This allows for quicker typing also. See below:

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
    layout_constraintStart_toCenterX   -> scx
    layout_constraintCenterX_toStart   -> cxs
    layout_constraintEnd_toCenterX     -> ecx
    layout_constraintCenterX_toEnd     -> cxe

    layout_constraintTop_toCenterY     -> tcy
    layout_constraintCenterY_toTop     -> cyt
    layout_constraintBottom_toCenterY  -> bcy
    layout_constraintCenterY_toBottom  -> cyb
    layout_constraintDimensionRatio    -> dim-ratio
    layout_constraintGuide_percent     -> guide-pct(in %)
    layout_constraintGuide_begin       -> guide-begin(in px or no units)
    layout_constraintGuide_end         -> guide-end(in px or no units)
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
24. w:num1%+num2//e.g w:32%+18 width is 32% that of parent plus 18 pixels
25. w:num1+num2%//e.g w:32+18% width is 18 pixels plus 32% that of parent 
26. w:num1%-num2//e.g w:32%-18 width is 32% that of parent minus 18 pixels
27  w:num1-num2%//e.g w:32-18% width is 32 pixels minus 18% that of parent 
28. h:num1%+num2//e.g h:32%+18 height is 32% that of parent plus 18 pixels
29. h:num1+num2%//e.g h:32+18% height is 18 pixels plus 32% that of parent 
30. h:num1%-num2//e.g h:32%-18 height is 32% that of parent minus 18 pixels
31  h:num1-num2%//e.g h:32-18% height is 32 pixels minus 18% that of parent 


```

These same rules apply to the height also. Note that division operation is not supported, only multiplication, addition
and subtraction.

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

If you are setting the width in terms of the height or the height in terms of the width, then ensure that you have
properly
defined the value of the other dimension e.g.

`w:height`<br>
`h:90px`<br>

OR

`w:height`<br>
`h:some_id`<br>

All these relationships help to define aspect ratios and more complicated relationships that give developers flexibility
in building UI.

`w:match_parent` and `h:match_parent` are supported.
`w:wrap_content` and `h:wrap_content` are only partially supported.
The implementation is not yet complete as regards these, for various reasons.

The underlying `autolayout.js` library does not seem to support `wrap_content`,so we are trying to provide some
implementation for it.

Note that where no units are specified, pixels are used. So `w:200` and `w:200px` are equivalent.
All these apply to `height` also.<br>
**CSS calc operations are not supported**<br>

#### maxW, maxH, minW, minH

These refer to the maximum width and maximum height, minimum width and minimum height
The implementation of these is not yet complete.

#### m

Refers to the margin around the element

#### mv and mh

Refer to the vertical (top and bottom) and horizontal margins around the html element

#### ms and me, mt and mb

Refer to the start(left) margin, the end(right) margin, and the top and bottom margins around the html element

The units supported for margins are pixels and percentages.
If no units are supplied, pixels are assumed.

#### cx and cy

Allows a view's center to be constrained horizontally or vertically to another view's center.<br>
The values accepted are either, `parent` or `view_id`; where `view_id` is the id of the view we are constraining this
view with respect to.

#### scx
Constrain the start`(s)` of a view to the horizontal center`(cx)` of another view using `scx`

#### tcy
Constrain the top`(t)` of a view to the vertical`(cy)` of another view using `tcy`

#### cxs
Constrain the horizontal center`(cx)` of a view to the start`(s)` of another view using `cxs`

#### cyt
Constrain the vertical center`(cy)` of a view to the top`(t)` of another view


#### ecx
Constrain the end`(e)` of a view to the horizontal center`(cx)` of another view using `ecx`

#### bcy
Constrain the bottom`(b)` of a view to the vertical`(cy)` of another view using `bcy`

#### cxe
Constrain the horizontal center`(cx)` of a view to the end`(e)` of another view using `cxe`

#### cyb
Constrain the vertical center`(cy)` of a view to the bottom`(b)` of another view

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
    <input id="phone_input" data-const="w:wrap_content; h: 42px; ss:parent; tt:parent; ms: 10; mt: 10;">
    <input id="password_input" data-const="w: phone_input; h: wrap_content;ss:phone_input@750; tb:phone_input;">
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

<div id="div1" data-const="w: 30%; h:width; ms:0px; mt:0px; cx: parent; cy: parent">
    <span id="p1"
          data-const="w: wrap_content; h:wrap_content; cx: parent; tt: parent; mt: 24px">
        LOGIN
    </span>
    <img id="login-icon" src="img.png" data-const="w:96px; h:width; tb:p1; bt: fullname; cx: parent">
    <input id="fullname" type="email" placeholder="Enter your email address..."
           data-const="w:76%; h: wrap_content; cx: parent; cy: parent">
    <input id="pwd" type="password" placeholder="Please input password..."
           data-const="w:fullname; h: fullname; cx: parent; tb: fullname; mt: 12px;">
    <input id="btn" type="button" tabindex="1" value="PROCEED"
           data-const="w:0.75*fullname; h: fullname; cx: parent; tb: pwd; mt: 18px;">
    <a href="https://www.linkedin.com" id="link"
       data-const="w: wrap_content; h:wrap_content; cx: parent; tb: btn; mt: 12px;">
        Forgot password?
    </a>
</div>
</body>
</html>
```

Another example can [be seen here](https://gbenroscience.github.io/layman/profile.html)

### **`onLayoutComplete`**

In case one needs to run some code after the layout is done, put your code within the `onLayoutComplete` function.
[Here is an example that uses the callback.](https://gbenroscience.github.io/layman/onlayout.html)

### CONSTRAINTS FREE HTML

If you want to keep your HTML code lean, you may override the global `layoutCode` function expression, and return a
javascript
object that defines the layout.
The syntax is really easy.
Make sure you override the function expression in a script tag after the script that imports `layman.js`, or you could
create a separate
script file, override it in that script and then import the script below the import statement for `layman.js`.
This is how you override the function expression:

```javascript
layoutCode = function () {
    return {
        body: {
            'data-guide-color': "#2A805F"
        },
        elements: {
            "sidebar": {
                w: "15%", h: "100%", ss: "parent", tt: "parent"
            },
            "app-title": {
                w: "match_parent", h: "48px", ss: "parent", tt: "parent"
            }
        }
    };
}
```

The `body` section can be used to define the color of the guidelines using the `data-guide-color` field.
The `elements` section will contain further subsections. Each of the subsections will have a key name which is the id of
the
html element that possesses the layout constraints being defined in that subsection. So above, `sidebar` and `app-title`
are both
ids of html elements on the page.

[Here is the former example that uses the `onLayoutComplete` function, but with its constraints abstracted into a JS object](https://gbenroscience.github.io/layman/layoutstyles.html)

### Modular design.

For `tags > v0.1.1`, you can now use client-side includes in your design.
Page sections can be defined in other files and referenced via the `src` attribute...e.g.

```HTML
<div id="profile-section" data-const="w: 30%;h:300px;src: /path/to/profile.html"></div>
```
Define the path relative to the current html document.

When using client side includes, you can only use inline constraints within the included files.
You cannot use the 
```javascript
layoutCode = function () {}
```
 as for the main document.
 
### Modular Popups
Using client-side includes, you can define sub-layouts that will be used to create modular popups also.
For instance:
```HTML
<div id="success-popup" data-const="w: 30%;h:300px;src: /path/to/popup.html;popup:true"></div>
```
Notice the `popup:true;` that needs to be added in addition to the `src` attribute for popups.
This is the only difference between showing popups and rendering included files within the page.
To show your popup, use the global `page` object and call `openPopup` like so:


```Javascript
 var popup = page.openPopup('success-popup', true, function(){},function(){});
```
1. The first argument is the id of the popup.
2. The second argument tells the library if you want the popup to be dismissed when the user clicks outside its layout.
3. The third argument is a function to run when the popup opens.
4. The fourth argument is a function to run when the popup closes.

Store the reference to the popup, so you can use it when you want to close it.

To close the popup, do:
```Javascript
 page.closePopup(popup);
```

OR:

```Javascript
popup.hide();
```


### Side Menus
Side Menus have been introduced.
They may open from the left or from the right depending on your definition.
To use a side menu:
Define an html div with an id in your html.
For example:
```HTML
<div id="feeds_menu"></div>
```
In your project, define a file to include as the layout for the side menu, e.g. call it `feeds.html` and put the html code
for the side menu in it.

In your layman layout code, for instance, do:
```Javascript
 feeds_menu:{
                w: "300px", h: "90%", "menu-left": true, src: "menus/feeds.html"
            },
```

Then simply call:
```Javascript
let sideMenuBtn = document.getElementById('open_feeds_icon');// a button on your page

            sideMenuBtn.onclick = function (e) {
                page.openSideMenu('feeds_menu', true, function(){}, function(){}, function(){});
            }; 
```


1. The first argument is the id of the sidemenu.
2. The second argument tells the library if you want the sidemenu to be dismissed when the user clicks outside its layout.
3. The third argument is a function to run when the sidemenu opens.
4. The fourth argument is a function to run when the sidemenu closes.
5. The fifth argument is a function that fires when the sidemenu's layout is first attached to the DOM successfully.



## More on Pages
Included layout rendering for sections of the document (or to be used on a popup or on a sidemenu) is handled by the Page class.

For true includes that involve loading remote layouts to be used in a section of the document, you may even specify more than 1 layout. This is not allowed for popups, neither for sidemenus.
So you may do 
```html
<div id="some_div" data-const="...;src:/aa/bb/cc.html,/dd/ee/ff.html,/dd/gg/mm.html"></div>
```
This will allow you to use multiple layouts on 1 document area.
This is useful for controlling the content seen in a page section by the simple use of a menu(list).
Once layouts are loaded, they are in memory and may be called for use by other layouts.
You may switch between the layouts like this:
```Javascript
page.renderInclude('page_holder', null, index);
```
Where `index` is the zero based index of a given layout in the comma separated list of layout paths assigned to the
src of the including div.


## Nested Includes Disallowed
When using included files, do not define additional includes in included files. We do not support nested includes for performance reasons.
If a good case can be made for it, we will include its support.
However here is a workaround for nested includes. `layman` allows you implement it yourself with `Dynamic layouts`

## Dynamic layouts
The latest commits`(tag v0.1.8)` allow you to dynamically fetch your layout(with inline tags) and render in a page section.
Say you have a layout file at `/includes/section.html` and you want to load it in a `div` whose id is: `remote_section`


`Code for section.html:`
```html
<style>
    #some_div{
        border: 1px solid black;
    }
</style>
<div id="some_div" data-const="w:300;h:300;cx:parent;cy:parent;">
    
    <canvas id="form_label" data-const="w:140;h:42;cx:parent;tt:40;custom-widget:label;mi-bg:transparent;mi-font-wt:bold;mi-font-nm:Kartika;mi-font-st:normal;mi-fg:black;mi-gravity:center;mi-font-sz:1em;">Enter Details</canvas>
    <input id="email" type="email" placeholder="Enter Email" data-const="w:parent-40;h:32;cx:parent; tb:form_label;mt:40">
    <input id="pwd" type="password" placeholder="Enter Password" data-const="w:email;h:email;cx:parent;tb:email;mt:8;">
    <input id="confpwd" type="password" placeholder="Confirm Password" data-const="w:email;h:email;cx:parent;tb:pwd;mt:8;">
    <input id="submit_details" type="button" value="SEND DETAILS" data-const="w:email;h:email;cx:parent;tb:confpwd;mt:8;">
    
</div>
```

```Javascript
var btn = document.getElementById('some_btn'); 
		btn.addEventListener('click', function (e) {
			page.loadRemoteAndShow("includes/section.html", 'remote_section', function (html) { 
			}, function (err) {
				console.log("err: " + JSON.stringify(err));
			});
		});
```



So use:
```Javascript
page.loadRemoteAndShow(path, includeID, loadSucc, loadErr) ;
```
to load a layout from your server(must be a layman layout with inline tags...data-const="args") and render in a div whose id is `includeID`. loadSucc and loadErr are both callbacks that take 1 argument each. loadSucc's argument is the html layout loaded from the server and loadErr's argument is the error that occurred when loading the layout.

When the button is clicked, it loads the layout and shows it in the div.


Also, you may use:
```Javascript
page.loadRemote(path, includeID, loadSucc, loadErr) ;
```
to load the remote layout for later use. This wont render the loaded file in the including div.
All these make preloading of remote views really convenient.


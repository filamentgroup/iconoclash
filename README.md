## Iconoclash

A workflow for configurable external svg sets.

Demo output: https://filamentgroup.github.io/iconoclash/demo/output/icons.html 


## How it works:

Pass an array of SVG files to iconoclash and it will combine them into a single SVG file with each file still referenceable by name. For example, once this icons.svg file is generated, your SVG files will be addressable by ID within that file, so if you started with an SVG called vespa.svg, you can reference  it from your page like this:

 ```html
<svg width="100" height="100">
    <use xlink:href="icons.svg#vespa"></use>
 </svg>
```

That single Icons.svg file can be used for all icons throughout your site and it only needs to load once, which is nice for performance and caching. However, a typical downside to using external SVG like this is that you can't easily use CSS to style particular shapes within that external SVG, say, to change the fill color of a particular group.

2. Iconoclash makes this problem go away by exposing CSS custom properties on the SVG elements you'd like to style. By default, it will find all fill properties within the svg that share common colors, and assign them a configurable shared CSS property. Changing that property in your parent page will change all instances of where that property is used in your external SVGs.

Here we have an `iconoclash-shared-0` property that will be shared by every other svg element in the set that has the same value. So you could override all icons to have a different fill for this one color by changing `iconoclash-shared-0`:

``` css
/* Iconoclash: CSS properties exposed from SVGs */
:root {
--iconoclash-shared-0: #E2574C;
}
```

These custom properties can be overridden from the HTML or another stylesheet, either globally, or to particular selectors or media queries.

```html
<svg width="100" height="100">
    <use xlink:href="icons.svg#baseball" style="--iconoclash-shared-0:blue;"></use>
 </svg>
 ```

3.
Additionally, SVG elements inside those files can have an ID attribute value that specifies CSS properties to exposed case-by-case so they can be customized. To specify properties, add the word `iconoclash` to the ID attribute followed by CSS property names you'd like to expose. For example, consider how this `g` element inside a file called vespa.svg starts to get transformed:

 - Before:  `<g stroke="#E2574C" id="iconoclash stroke">`
 - After:   `<g stroke="#E2574C" style="fill: var(--vespa-path2-stroke, var(--iconoclash-shared-0, #E2574C));">`

Note that Iconoclash sets the defaults for each of these CSS custom properties either to an existing value on the shape, or to 'initial'. It also sets the custom properties to share global values that are similar, so you can modify shared brand colors and values across your SVGs while still overriding single instances:




## Usage

Pass an array of file paths and an output folder path to the  Iconoclash function.

```js 
var Iconoclash = require('../src/iconoclash');
var iconoclash = new Iconoclash( ["./svg/lamp.svg", "./svg/skate.svg", "./svg/vespa.svg"], "./output/" );
iconoclash.process();
```

You can try this by running the testrun file like this:

```
$ cd demo && node testrun
```

### options

The Iconoclash function accepts a third option to override these defaults:

```
{
    iconcss: 'icons.css',
    iconsvg: 'icons.svg',
    icondata: 'icons.json',
    iconhtml: "icons.html",
    htmlinput: "../src/preview.html",
    idKey: "iconoclash",
    autoExpose: ["fill"],
    banner: "/* Iconoclash: CSS properties exposed from SVGs */",
    svgstyles: "svg > g {display:none;} svg > g:target{display:inline}",
    verbose: false,
    logger: {
        verbose: console.info,
        fatal: console.error,
        ok: console.log
    }
}
```

## IconoClash

A workflow for configurable external svg sets.

TLDR: Take a folder of svgs, ID the shapes in the svg that you'd like to have customizable properties, and reference them as one external sprite from HTML.

Demo output: 

Explainer:

1. `/svg` has the svg files. Any shapes in those files can have an ID attribute that starts with `custom` followed by properties you'd like to expose as overrideable CSS vars. For example, `<g id="custom fill transform">`
2. When you run `node build.js`, a script looks for svgs in that svg folder, and packs them together into a bunch of symbols in one svg sprite. All of the shapes in those svgs that had an ID for custom properties will end up with a style attribute with those properties set from CSS vars. It writes that SVG to [`demo/icons.svg`](demo/icons.svg)
3. That script also generates a CSS file [`demo/icons.css`](demo/icons.css) which defines those custom properties uniquely, named spaced to the graphic they come from. Like this:
``` css
:root {
--vespa-item0-fill:#E2574C;
--vespa-item1-fill:#AAAAAA;
--skate-item0-fill:#E2574C;
--skate-item1-path:#AAAAAA;
}
```
4. The HTML can use any icons in the set via the same external SVG, by referencing the name of the graphic via its ID as a hash url: 
```html
<svg width="100" height="100">
    <use xlink:href="icons.svg#vespa"></use>
 </svg>
```

5. Any exposed vars in that graphic can be overridden from the HTML or another stylesheet:
```html
<svg width="100" height="100">
    <use xlink:href="icons.svg#vespa" style="--vespa-item0-fill:blue;--vespa-item1-fill:green;"></use>
 </svg>
 ```

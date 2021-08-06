/*global require:true*/
/*global module:true*/
/*global __dirname:true*/
/*global console:true*/
(function(){
	"use strict";
	
	const svgstore = require('svgstore');
	const path = require( "path" );
	const fs = require( "fs-extra" );
	const _ = require('lodash');
	const Mustache = require('mustache');
	const gzipSize = require('gzip-size');


	var defaults = {
		// filename for containing custom icon css rules for background image usage
		iconcss: 'icons.css',
		// filename for icons sprite, if writeIndividualFiles is false (default)
		iconsvg: 'icons.svg',
		// filename for output data which can be useful for building preview pages and docs
		icondata: 'icons.json',
		// filename for preview page for displaying icons
		iconhtml: "icons.html",
		// input for preview page containing templating to create icons.html
		htmlinput: path.join( __dirname, "preview.html" ),
		// prefix inside svg shape ID attributes used for custom overriding per element
		idKey: "iconoclash",
		// attributes to compare across svg files and expose shared properties
		autoExpose: ["fill"],
		// option to not build a sprite svg, instead allowing for addressable single files
		writeIndividualFiles: false,
		// in cases where auto-exposed attributes, eg fill, 
		// are using defaults and not specified at all on svg shape elements, this adds them with an "inherit" value
		setAutoExposeDefaults: false,
		// don't go looking for customizations inside these
		ignoreInsideElems: 'a|altGlyphDef|clipPath|color-profile|cursor|filter|font|font-face|foreignObject|image|marker|mask|pattern|script|style|switch|text|view',
		// comment at the top of the css output
		banner: "/* Iconoclash: CSS properties exposed from SVGs */",
		// styles at the top of each output svg file that'll allow for background image use to work by show/hiding a group by ID/target
		svgstyles: "svg > g {display:none;} svg > g:target{display:inline}",
		// logging output
		verbose: false,
		logger: {
			verbose: console.info,
			fatal: console.error,
			ok: console.log
		}
	};

	var disabledLogger = {
		verbose: function() {},
		fatal: console.error,
		ok: function() {}
	};


	var Iconoclash = function(files, output, config){
		config = config || {};

		if( !Array.isArray( files ) ){
			throw new Error( "The first argument passed into the Iconoclash constructor must be an array of files" );
		}

		if( typeof output !== "string" ){
			throw new Error( "The second argument passed into the Iconoclash constructor must be a string, a path to an output directory" );
		}

		this.files = files;
		this.output = output;
		this.options = _.defaultsDeep( config, defaults );
		this.logger = this.options.verbose ? this.options.logger : disabledLogger;
		
	};

	// use filename to make an svg symbol's ID
	Iconoclash.prototype._symbolIDFromFile = function(file){
		return file.match( /([^\/]+)\.svg/, "" )[1].replace( /\#|\>|\]|\]| |\./gmi, "-" );
	};

	// just filename
	Iconoclash.prototype._fileName = function(file){
		return file.match( /([^\/]+\.svg)/, "" )[1];
	};

	Iconoclash.prototype.process = function(cb){
		var config = this.options;
		var logger = this.logger;
		var that = this;
		logger.ok( "Iconoclash is processing " + this.files.length + " svg files." );
		// dataContainer ends up in the JSON output file and also drives the data for the preview page templates
		var dataContainer = {};
		var data = dataContainer.icons = [];
		// used for finding shared css values to expose
		var sharedData = dataContainer.sharedProps = [];
		var CSS = [];
		var classes = [];
		
		var globals = {};
		// sprites is our svg sprite that we'll add every icon svg to as we manipulate their properties and extract shared vars
		// even if we write out to separate files in the end, we'll use a single sprite first to do this work
		var sprites = svgstore();

		// note: adding styles here in defs inside every svg. This is necessary to show/hide the right symbol when svg is referenced in a bg image
		// also note: this empty string arg is required and it injects an empty symbol. Harmless but would be nice to clean out later.
		sprites.add("", "<defs><style>" + config.svgstyles + "</style></defs>");

		this.files.forEach(function(file) {
			let stat= fs.statSync(file);
			if ( stat.isFile() && file.indexOf(".svg") > -1 ) {  
				let id = that._symbolIDFromFile(file);
				// data ends up being used here and then exported to json
				var svgdata = {
					id: id,
					file: that._fileName(file),
					size: (parseFloat(stat.size) * 0.001).toFixed(2) + "kb",
					target: (config.writeIndividualFiles ? id + ".svg" : config.iconsvg ) + "#"+ id,
					// todo: this background width and height would do better to use the svg's sizing. 
					cssBG: "." + config.idKey + "-" + id + "{  background-image: url('"+ config.iconsvg +"#"+ id + "-bg'); background-repeat: no-repeat; background-size: 20px 20px; background-size: var(--"+ config.idKey +"-bgsize, 20px 20px); }",
					elems: []
				};

				// add svg to the sprite using svgstore's add method
				sprites.add(id, fs.readFileSync(file, 'utf8') );
				// add this svg's css background to the big css file
				classes.push( svgdata.cssBG  );
				data.push(svgdata);

			}
		}); 

		// make groups for each symbol so they can be referenced via background img
		// the add method makes a symbol unfortunately, so we change it to a g later
		sprites.element('symbol[id]').each(function(){
			var id = this.attribs.id;
			sprites.add( id + "-temporaryiconoclashsuffix", '<svg><use href="#' + id + '"/></svg>' );
		});

		// make bg specific symbols into groups based on unfortunate naming workaround
		sprites.element('symbol[id$="-temporaryiconoclashsuffix"]').each(function(){
			this.name = "g";
			this.attribs.id = this.attribs.id.replace("temporaryiconoclashsuffix", "bg" );
		});

		function getParentNode(elem){
			if(elem.parentNode.name === "symbol"){
				return elem.parentNode;
			}
			else {
				return getParentNode(elem.parentNode);
			}
		}

		// iconoclash will only see and compare attributes that are set explicitly
		// for example, a path might rely on its black default stroke, but unless it has fill="black" or fill="initial", 
		// we won't see it. that's often fine - maybe you only want explicitly set attributes to be exposed for customizing.
		// but if you want them all to be customizable
		// this option will set all autoExpose'd attrs to 'initial' if they are not defined
		// default false since it could cause unexpected results, (though it shouldn't)
		if( config.setAutoExposeDefaults  ){
			sprites.element('symbol path, symbol rect, symbol circle, symbol ellipse, symbol line, symbol polyline, symbol polygon').each(function(){
				let elem = this;
				config.autoExpose.forEach(function(i){
					if(!elem.attribs[i]){
						elem.attribs[i] = "initial";
					}
				});
			});
		}

		var k = 0;

		// loop the svg elements that have customizations to expose, across all 
		var selector = ["*[id*='iconoclash']"].concat(config.autoExpose.map(function(i){
			return "*[" + i + "]";
		}))
		.join(",");

		sprites.element( selector ).each(function(i){
			// make sure we're not dealing with defs elems
			if(this.parent.name.match( config.ignoreInsideElems )){
				return;
			}
			var parent = getParentNode(this);
			var parentName = parent.attribs.id;
			var id = this.attribs.id;
			var localCustomizations = false;
			if( id ){
				localCustomizations = id.indexOf( config.idKey ) > -1 && id.split( config.idKey )[1];
			}
			if( !id || !localCustomizations ){
				id = config.idKey;
			}
			id += " " + config.autoExpose.join(" ");
			var elemType = this.name;
			var afterKey = id.split( config.idKey )[1];
			var elemData = {};
			elemData.elemType = elemType;
			// assume any space separated values after the key are css props to expose
			var customProps = afterKey.match(/([^ _\d]+)/g);
			if( customProps.length ){
				logger.verbose( "Iconoclash found an SVG "+ elemType +" with CSS properties to expose: " + customProps.join(", "));
				elemData.cssProps = {};
				elemData.sharedProps = [];
				elemData.localProps = [];

				for( var j = 0; j < customProps.length; j++ ){
					var prop = customProps[ j ];
					var itemVar = "--" + parentName + "-" + elemType + (i+1) + "-" + prop;
					// fallbacks will be the last argument in the css custom property usage
					var fallback = "initial";
					if( this.attribs[prop] !== undefined ){
						fallback = this.attribs[prop];
					}

					var cssText = "";

					if( !globals[fallback] && (config.setAutoExposeDefaults === true || config.fallback !== "initial") ) {
						globals[fallback] = "--iconoclash-shared-" + k++;
						
					}

					if( globals[fallback] && (config.setAutoExposeDefaults === true || config.fallback !== "initial") ){
						if( localCustomizations ){
							cssText = prop + ": var(" + itemVar + ", var("+ globals[fallback] + "," + fallback +"))";
						}
						else {
							cssText = prop + ": var("+ globals[fallback] + "," + fallback +")";
						}
						var sharedPropRule = globals[fallback] + ": " + fallback + ";";
						if( CSS.indexOf(sharedPropRule) === -1 ){
							CSS.push( sharedPropRule );
							sharedData.push( { 
								"prop": globals[fallback], 
								"value": fallback 
							});
						}
						elemData.sharedProps.push( { "rule": sharedPropRule } );
						
					}
					else if (localCustomizations) {
						cssText = prop + ":  var("+ itemVar + "," + fallback +")";
					}

					if ( localCustomizations && localCustomizations.indexOf( prop ) > -1 ) {
						var localPropRule = itemVar + ": initial;";
						CSS.push( localPropRule );
						elemData.localProps.push( { "rule": localPropRule } );
						
					}
					customProps[ j ] = cssText;
					
					logger.verbose( "    - Iconoclash added a style to the "+ elemType + ": " + customProps[ j ]);
					
					
				}
				elemData.cssText = customProps.join(";");
				data.find(x => x.id === parentName).elems.push( elemData );
				this.attribs.style = elemData.cssText;
			}
		});

		// add shared bg size rule
		// todo: this could be more customized via svg particulars
		CSS.push( "--"+ config.idKey + "-bgsize: 20px 20px" );

		// write one svg sprite, by default
		if( !config.writeIndividualFiles ){
			fs.writeFileSync(this.output + config.iconsvg, sprites);
		}
		// or if not, write out individual files by teasing them out of the sprite and making new ones
		// this could be more efficient I'm sure. But the approach is helpful because having them all in the sprite to start helps in exposing shared props
		else{
			// make a new sprite for each symbol, 
			// set its children to a filtered subset of the big sprite
			// based on the matching children from the big sprite
			let outDir = this.output;
			sprites.element("symbol").each(function(){
				let id = this.attribs.id;
				if(id ){
					let thisSprite = svgstore();
					let subsymbols = sprites.element.root()[0].children[0].children.filter(function(child){
						return child.name === "defs" || child.attribs.id && child.attribs.id.indexOf( id ) > -1;
					})
					thisSprite.element.root()[0].children[0].children = subsymbols;

					fs.writeFileSync(outDir + id + ".svg", thisSprite);
				}
			});
			
		}
		// write more dist files
		let svgStat= fs.statSync(this.output + config.iconsvg);
		let svgFile = fs.readFileSync(this.output + config.iconsvg, 'utf8');
		dataContainer.icons.svgFileSize = (svgStat.size * .001).toFixed(2) + "kb";
		dataContainer.icons.svgGzipFileSize = (gzipSize.sync(svgFile) * .001).toFixed(2) + "kb";
		

		fs.writeFileSync(this.output + config.icondata, JSON.stringify( dataContainer ) );
		fs.writeFileSync(this.output + config.iconcss, config.banner + "\n:root {\n" + CSS.join(";\n") + "\n}\n\n" + classes.join("\n") );

		var previewHTMLInput = fs.readFileSync(config.htmlinput, 'utf8');
		Mustache.escape = function(text) {return text;}
		var preview = Mustache.render(previewHTMLInput, dataContainer );
		fs.writeFileSync(this.output + config.iconhtml, preview );

		logger.ok( "Iconoclash processed " + this.files.length + " files." );

		if(cb){
			cb();
		}
	};

	module.exports = Iconoclash;


}(typeof exports === 'object' && exports || this));

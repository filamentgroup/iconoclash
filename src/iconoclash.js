/*global require:true*/
/*global module:true*/
/*global __dirname:true*/
/*global console:true*/
(function(){
	"use strict";
	
	var svgstore = require('svgstore');
	var path = require( "path" );
	var fs = require( "fs-extra" );
	var _ = require('lodash');
	var Mustache = require('mustache');
	const gzipSize = require('gzip-size');


	var defaults = {
		iconcss: 'icons.css',
		iconsvg: 'icons.svg',
		icondata: 'icons.json',
		iconhtml: "icons.html",
		htmlinput: path.join( __dirname, "preview.html" ),
		idKey: "iconoclash",
		autoExpose: ["fill"],
		ignoreInsideElems: 'a|altGlyphDef|clipPath|color-profile|cursor|filter|font|font-face|foreignObject|image|marker|mask|pattern|script|style|switch|text|view',
		banner: "/* Iconoclash: CSS properties exposed from SVGs */",
		svgstyles: "svg > g {display:none;} svg > g:target{display:inline}",
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

	Iconoclash.prototype._symbolIDFromFile = function(file){
		return file.match( /([^\/]+)\.svg/, "" )[1].replace( /\#|\>|\]|\]| |\./gmi, "-" );
	};

	Iconoclash.prototype._fileName = function(file){
		return file.match( /([^\/]+\.svg)/, "" )[1];
	};

	Iconoclash.prototype.process = function(cb){
		var config = this.options;
		var logger = this.logger;
		var that = this;
		logger.ok( "Iconoclash is processing " + this.files.length + " svg files." );
		var dataContainer = {};
		var data = dataContainer.icons = [];
		var sharedData = dataContainer.sharedProps = [];
		var CSS = [  ];
		var classes = [];
		
		var globals = {};
		var sprites = svgstore();

		// note: adding styles here in defs. This is necessary to show/hide the right symbol when svg is referenced in a bg image
		// also note: this empty string arg is required and it injects an empty symbol. Harmless but not enough to clean up rn.
		sprites.add("", "<defs><style>" + config.svgstyles + "</style></defs>");

		this.files.forEach(function(file) {
			let stat= fs.statSync(file);
			if ( stat.isFile() && file.indexOf(".svg") > -1 ) {  
				let id = that._symbolIDFromFile(file);
				var svgdata = {
					id: id,
					file: that._fileName(file),
					size: (parseFloat(stat.size) * 0.001).toFixed(2) + "kb",
					target: config.iconsvg +"#"+ id,
					//temp width height etc here
					cssBG: "." + config.idKey + "-" + id + "{  background-image: url('"+ config.iconsvg +"#"+ id + "-bg'); background-repeat: no-repeat; background-size: 20px 20px; background-size: var(--"+ config.idKey +"-bgsize, 20px 20px); }",
					elems: []
				};

				// add svg to the sprite
				sprites.add(id, fs.readFileSync(file, 'utf8') );
				classes.push( svgdata.cssBG  );
				data.push(svgdata);

			}
		}); 

		// make groups for each symbol so they can be referenced via background img
		sprites.element('symbol[id]').each(function(){
			var id = this.attribs.id;
			sprites.add( id + "-temporaryiconoclashsuffix", '<svg><use href="#' + id + '"/></svg>' );
		});

		// make bg specific symbols into groups
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
					var fallback = "initial";
					if( this.attribs[prop] !== undefined ){
						fallback = this.attribs[prop];
					}

					var cssText = "";

					if( !globals[fallback] && fallback !== "initial" ) {
						globals[fallback] = "--iconoclash-shared-" + k++;
						
					}

					if( globals[fallback] && fallback !== "initial" ){
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
		CSS.push( "--"+ config.idKey + "-bgsize: 20px 20px" );


		fs.writeFileSync(this.output + config.iconsvg, sprites);
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

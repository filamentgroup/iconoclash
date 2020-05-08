/*global require:true*/
/*global module:true*/
/*global console:true*/
(function(){
	"use strict";
	
	var svgstore = require('svgstore');
	var fs = require( "fs-extra" );
	var _ = require('lodash');
	var Mustache = require('mustache');

	var defaults = {
		iconcss: 'icons.css',
		iconsvg: 'icons.svg',
		icondata: 'icons.json',
		iconhtml: "icons.html",
		htmlinput: "../src/preview.html",
		sharedonly: false,
		idKey: "iconoclash",
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
					source: fs.readFileSync(file, 'utf8'),
					target: config.iconsvg +"#"+ id,
					//temp width height etc here
					cssBG: "." + config.idKey + "-" + id + "{ width: 100px; height: 100px;  background: url('"+ config.iconsvg +"#"+ id +"') no-repeat; background-size: contain; }",
					elems: []
				};

				// add svg to the sprite
				sprites.add(id, svgdata.source );
				classes.push( svgdata.cssBG  );
				data.push(svgdata);

			}
		}); 

		// make symbols into groups
		sprites.element('symbol[id]').each(function(){
			//this.name = "g";
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
		sprites.element("*[fill]").each(function(i){
			var parent = getParentNode(this);
			var parentName = parent.attribs.id;
			var id = "iconoclash fill";//this.attribs.id;		
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

					if( globals[fallback] ){
						cssText = prop + ": var(" + itemVar + ", var("+ globals[fallback] + "," + fallback +"))";
						var sharedPropRule = globals[fallback] + ": " + fallback + ";";
						if( CSS.indexOf(sharedPropRule) === -1 ){
							CSS.push( sharedPropRule );
						}
						elemData.sharedProps.push( { "rule": sharedPropRule } );
						
					}
					else if (config.sharedonly === false) {
						cssText = prop + ":  var("+ itemVar + "," + fallback +")";
					}

					if (config.sharedonly === false) {
						var localPropRule = itemVar + ": initial; /* default: " + fallback + "*/";
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


		fs.writeFileSync(this.output + config.iconsvg, sprites);
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

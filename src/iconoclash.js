/*global require:true*/
/*global module:true*/
/*global console:true*/
(function(){
	"use strict";
	
	var svgstore = require('svgstore');
	var fs = require( "fs-extra" );
	var _ = require('lodash');

	var defaults = {
		iconcss: 'icons.css',
		iconsvg: 'icons.svg',
		icondata: 'icons.json',
		previewhtml: "icons.html",
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

	Iconoclash.prototype.process = function(cb){
		var config = this.options;
		var logger = this.logger;
		var that = this;
		logger.ok( "Iconoclash is processing " + this.files.length + " svg files." );
		var data = {};
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
				
				data[ id ] = {
					srcFile: file,
					srcFileContent: fs.readFileSync(file, 'utf8'),
					svgPath: config.iconsvg +"#"+ id,
					//temp width height etc here
					cssBG: "." + config.idKey + "-" + id + "{ width: 100px; height: 100px;  background: url('"+ config.iconsvg +"#"+ id +"') no-repeat; background-size: contain; }",
					elems: []
				};

				// add svg to the sprite
				sprites.add(id, data[ id ].srcFileContent );
				classes.push( data[ id ].cssBG  );
			}
		}); 

		// make symbols into groups
		sprites.element('symbol[id]').each(function(){
			this.name = "g";
		});


		var k = 0;
		// loop the svg elements that have customizations to expose, across all 
		sprites.element("[id*='" + config.idKey + "']").each(function(i){
			var parentName = this.parentNode.attribs.id;
			var width = this.parentNode.attribs.width;
			var height = this.parentNode.attribs.width;
			var id = this.attribs.id;		
			var elemType = this.name;
			var afterKey = id.split( config.idKey )[1];
			var elemData = {};
			elemData.width = width;
			elemData.height = height;
			elemData.elemType = elemType;
			// assume any space separated values after the key are css props to expose
			var customProps = afterKey.match(/([^ _\d]+)/g);
			if( customProps.length ){
				logger.verbose( "Iconoclash found an SVG "+ elemType +" with CSS properties to expose: " + customProps.join(", "));
				elemData.cssProps = {};

				for( var j = 0; j < customProps.length; j++ ){
					var prop = customProps[ j ];
					var itemVar = "--" + parentName + "-" + elemType + (i+1) + "-" + prop;
					var fallback = this.attribs[prop] || "initial";
					var cssText = "";
					

					if( !globals[fallback] && fallback !== "initial" ) {
						globals[fallback] = "--iconglobal-" + k++;
						
						CSS.push( globals[fallback] + ": initial" );
					}

					if( globals[fallback] ){
						cssText = prop + ": var(" + itemVar + ", var("+ globals[fallback] + "," + fallback +"))";
					}
					else {
						cssText = prop + ":  var("+ itemVar + "," + fallback +")";
					}
					CSS.push( itemVar + ": initial" );
					customProps[ j ] = cssText;
					
					logger.verbose( "    - Iconoclash added a style to the "+ elemType + ": " + customProps[ j ]);

					elemData.cssProps[ prop ] = {
						"localCSSVar": itemVar,
						"globalCSSvar": globals[fallback],
						"fallbackValue": fallback,
						"cssText": cssText
					};
				}
				
				elemData.cssText = customProps.join(";");
				data[ parentName ].elems.push( elemData );
				this.attribs.style = elemData.cssText;
			}
		});


		fs.writeFileSync(this.output + config.iconsvg, sprites);
		fs.writeFileSync(this.output + config.icondata, JSON.stringify( data ) );
		fs.writeFileSync(this.output + config.iconcss, config.banner + "\n:root {\n" + CSS.join(";\n") + "\n}\n\n" + classes.join("\n") );

		logger.ok( "Iconoclash processed " + this.files.length + " files." );

		if(cb){
			cb();
		}
	};

	module.exports = Iconoclash;


}(typeof exports === 'object' && exports || this));

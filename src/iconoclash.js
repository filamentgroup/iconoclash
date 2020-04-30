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
		previewhtml: "icons.html",
		idKey: "iconoclash",
		banner: "/* Iconoclash: CSS properties exposed from SVGs */",
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

		var CSS = [];
		var sprites = svgstore();

		this.files.forEach(function(file) {
			let stat= fs.statSync(file);
			if ( stat.isFile() && file.indexOf(".svg") > -1 ) {  
				sprites.add(that._symbolIDFromFile(file), fs.readFileSync(file, 'utf8'));
			}
		}); 

		sprites.element("[id*='" + config.idKey + "']").each(function(i){
			var parentName = this.parentNode.attribs.id;
			var id = this.attribs.id;
			var elemType = this.name;
			var afterKey = id.split( config.idKey )[1];
			// assume any space separated values after the key are css props to expose
			var customProps = afterKey.match(/([^ _\d]+)/g);
			if( customProps.length ){
				logger.verbose( "Iconoclash found an SVG "+ elemType +" with CSS properties to expose: " + customProps.join(", "));

				for( var j = 0; j < customProps.length; j++ ){
					var prop = customProps[ j ];
					var cssVar = "--" + parentName + "-" + elemType + (i+1) + "-" + prop;
					customProps[ j ] += ": var(" + cssVar + ")";
					logger.verbose( "    - Iconoclash added a style to the "+ elemType + ": " + customProps[ j ]);

					CSS.push( cssVar + ":" + (this.attribs[prop] || "initial") );
					logger.verbose( "    - Iconoclash set the default of the "+ cssVar +" CSS property to '"+ (this.attribs[prop] || "initial") +"'" );
				}
				this.attribs.style = customProps.join(";");
			}
		});

		fs.writeFileSync(this.output + config.iconsvg, sprites);
		fs.writeFileSync(this.output + config.iconcss, config.banner + "\n:root {\n" + CSS.join(";\n") + "\n}" );

		logger.ok( "Iconoclash processed " + this.files.length + " files." );

		if(cb){
			cb();
		}
	};

	module.exports = Iconoclash;


}(typeof exports === 'object' && exports || this));

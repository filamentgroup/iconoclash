var Iconoclash = require('../src/iconoclash');
var fs = require('fs');
var dir = fs.readdirSync("./svg", "utf-8");
dir = dir.map(file => './svg/' + file);
var iconoclash = new Iconoclash( dir, "./output/", { autoExpose: ["fill", "stroke"], writeIndividualFiles: true } );
iconoclash.process();

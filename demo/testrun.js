var Iconoclash = require('../src/iconoclash');
var iconoclash = new Iconoclash( [ 
    "./svg/skate.svg", 
    "./svg/vespa.svg", 
    "./svg/conveyor.svg", 
    "./svg/lamp.svg"
], "./output/" );
iconoclash.process();

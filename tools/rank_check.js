global.window={};const d3=require('d3');global.d3=d3;require('./v4/data.js');require('./v4/medals.js');require('./v4/badges.js');
global.document={getElementById:()=>({}),createElement:()=>({getContext:()=>({measureText:()=>({width:10})})}),addEventListener(){}};global.localStorage={getItem:()=>null};
const fs=require('fs');let src=fs.readFileSync('v4/core.js','utf8').replace(/^'use strict';/,'');
const vm=require('vm');const ctx={window,d3,document,localStorage,console,getComputedStyle:()=>({getPropertyValue:()=>''})};vm.createContext(ctx);
vm.runInContext(src+'\n'+process.argv[2],ctx);

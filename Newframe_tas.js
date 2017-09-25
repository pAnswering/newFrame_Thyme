/**
 * Created by ryeubi on 2015-08-31.
 */

var net = require('net');
var util = require('util');
var fs = require('fs');
var xml2js = require('xml2js');
var exec = require("child_process").exec;
var sensorLib = require('node-dht-sensor');
//var sh_serial = require('./serial');

var useparentport = '3105';
var useparenthostname = '';

var upload_arr = [];
var download_arr = [];

// This is an async file read
fs.readFile('conf.xml', 'utf-8', function (err, data) {
    if (err) {
        console.log("FATAL An error occurred trying to read in the file: " + err);
        console.log("error : set to default for configuration")
    }
    else {
        var parser = new xml2js.Parser({explicitArray: false});
        parser.parseString(data, function (err, result) {
            if (err) {
                console.log("Parsing An error occurred trying to read in the file: " + err);
                console.log("error : set to default for configuration")
            }
            else {
                var jsonString = JSON.stringify(result);
                conf = JSON.parse(jsonString)['m2m:conf'];

                useparenthostname = conf.tas.parenthostname;
                useparentport = conf.tas.parentport;

                if(conf.upload != null) {
                    if (conf.upload['ctname'] != null) {
                        upload_arr[0] = conf.upload;
                    }
                    else {
                        upload_arr = conf.upload;
                    }
                }

                if(conf.download != null) {
                    if (conf.download['ctname'] != null) {
                        download_arr[0] = conf.download;
                    }
                    else {
                        download_arr = conf.download;
                    }
                }

                //sh_serial.open(usecomport, usebaudrate);
            }
        });
    }
});


var tas_state = 'connect';
tas_man_count = 0;

var upload_client = new net.Socket();

upload_client.connect(useparentport, useparenthostname, function() {
            console.log('upload Connected');
            tas_download_count = 0;
            for (var i = 0; i < download_arr.length; i++) {
                console.log('download Connected - ' + download_arr[i].ctname + ' hello');
                var cin = {ctname: download_arr[i].ctname, con: 'hello'};
                upload_client.write(JSON.stringify(cin) + '<EOF>');
            }

            if (tas_download_count >= download_arr.length) {
                tas_state = 'upload';
            }
});



upload_client.on('data', function(data) {

    if (tas_state == 'connect' || tas_state == 'reconnect' || tas_state == 'upload') {
        var data_arr = data.toString().split('}');
        for(var i = 0; i < data_arr.length-1; i++) {
            var line = data_arr[i];
            line += '}';
            var sink_str = util.format('%s', line.toString());
            var sink_obj = JSON.parse(sink_str);

            if (sink_obj.ctname == null || sink_obj.con == null) {
                console.log('Received: data format mismatch');
            }
            else {

                if (sink_obj.con == 'hello') {
                    console.log('Received: ' + data);

                    if (tas_man_count >= download_arr.length) {
                        tas_state = 'upload';
                    }
                }
                else {
                    for (var j = 0; j < upload_arr.length; j++) {
                        if (upload_arr[j].ctname == sink_obj.ctname) {
                            console.log('ACK : ' + line + ' <----');
                            break;
                        }
                    }

                    for (j = 0; j < download_arr.length; j++) {
                        if (download_arr[j].ctname == sink_obj.ctname) {

                            break;
                        }
                    }
                }
            }
        }
    }
});


var count = 0;
var humid = -1;
var temp = -1;



var sensor = {
 initialize: function () {
   return sensorLib.initialize(11, 4); // dht version: 11, using 25 pin
 },
 read: function () {
   var readout = sensorLib.read();
   if(tas_state == 'upload') {
       for(var i = 0; i < upload_arr.length; i++) {
	console.log(upload_arr.length);
           if(upload_arr[i].ctname == 'cnt-temp') {
		if(readout.temperature.toFixed(4) >= temp +0.3  || readout.temperature.toFixed(2) <= temp - 0.3 || count >= 5){
               		var cin = {ctname: upload_arr[i].ctname, con: readout.temperature.toFixed(2)};
               		console.log('SEND : ' + JSON.stringify(cin) + ' ---->');
               		upload_client.write(JSON.stringify(cin) + '<EOF>');
			temp = readout.temperature.toFixed(2);
		}
		else count ++;
		console.log(temp);

           }
           else if(upload_arr[i].ctname == 'cnt-humid') {
               var cin = {ctname: upload_arr[i].ctname, con: readout.humidity.toFixed(2)};
               console.log('SEND : ' + JSON.stringify(cin) + ' ---->');
               upload_client.write(JSON.stringify(cin) + '<EOF>');
             	break;
           }
       }
   }

   console.log('Temperature: ' + readout.temperature.toFixed(4) + 'C, ' + 'humidity: ' + readout.humidity.toFixed(2) + '%');
   setTimeout(function () {
     sensor.read();
   }, 1000);
 }
};

if (sensor.initialize()) {
 sensor.read();
} else {
 console.warn('Failed to initialize sensor');
}


upload_client.on('error', function(err) {
    tas_state = 'reconnect';
});

upload_client.on('close', function() {
    console.log('Connection closed');
    upload_client.destroy();
    tas_state = 'reconnect';
});

//
var Gpio = require('rpi-gpio')
Gpio.setup(14, Gpio.DIR_IN, readInput);
function readInput(){
  Gpio.read(14,function(err, value){
    console.log('The value is'+value);
  });
}

var util = require('util');

var bleno = require('bleno');

const io = require("socket.io-client");
const socket = io("ws://localhost:3000");

var challenge = "1234567890abcdef1234567890abcdef";

socket.on("connection", socket => {
	console.log("Socket connected");
});

socket.on("challenge-value", (chall) => {
	console.log("\n---\nWebsocket received challenge value: " + chall + '\n---\n');
	challenge = chall;
});

var BlenoCharacteristic = bleno.Characteristic;
var Descriptor = bleno.Descriptor;

var AuthCharacteristic = function() {
	AuthCharacteristic.super_.call(this, {
		uuid: '00000009-0000-3512-2118-0009af100700',
		properties: ['read','writeWithoutResponse','notify'],
		value: '',
		descriptor: new Descriptor({
			uuid: '2902',
			value: new Buffer('00','hex')
		})
	});

};

util.inherits(AuthCharacteristic, BlenoCharacteristic);

AuthCharacteristic.prototype.onReadRequest = function(offset, callback) {
	console.log('AuthCharacteristic - onReadRequest: value = ' + this._value.toString('hex'));
	callback(this.RESULT_SUCCESS, this._value);
};


AuthCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
	this._value = data;
	var delay = 0;
	console.log('AuthCharacteristic - onWriteRequest: value = ' + this._value.toString('hex'));

	if (data.toString('hex').substr(0,4) == '0100') {
		if (data.toString('hex').length == 4) {
			console.log('Sending protocol version packet');
			this._value = new Buffer('100104','hex');
			console.log("\n---\nWebsocket sent challenge-request\n---\n");
			socket.emit("challenge-request");
			delay = 1000;
		}
		else {
			console.log('Sending authkey accepted');
			this._value = new Buffer('100101','hex');
		}
	}

	if (data.toString('hex') == '020002') {
		this._value = new Buffer('100204','hex');
	}
	
	if (data.toString('hex') == '0200') {
		console.log('Sending challenge after request: ' + challenge);
		this._value = new Buffer('100201' + challenge,'hex');
	}

	if (data.toString('hex').substr(0,4) == '0300') {
		console.log('Sending solution accepted'); 
		var solution = data.toString('hex').substr(4,36);
		console.log('\n---\nWebsocket sent challenge-solution: ' + solution + '\n---\n'); 
		socket.emit("challenge-solution", solution);
		this._value = new Buffer('100301','hex');
	}
	
	var tuvc = this._updateValueCallback;
	var tv = this._value;
	var cb = callback;
	var trs = this.RESULT_SUCCESS;
	
	setTimeout( delayedUpdate, delay );
	
	function delayedUpdate() {
		if (tuvc) {
			console.log('AuthCharacteristic - onWriteRequest: notifying');
			tuvc(tv);
		}
		cb(trs);
	}

};

AuthCharacteristic.prototype.onSubscribe = function(maxValueSize, updateValueCallback) {
	console.log('AuthCharacteristic - onSubscribe');
	this._updateValueCallback = updateValueCallback;
};

AuthCharacteristic.prototype.onUnsubscribe = function() {
	console.log('AuthCharacteristic - onUnsubscribe');
	this._updateValueCallback = null;
};

module.exports = AuthCharacteristic;

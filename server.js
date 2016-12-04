

var http = require('http');
var url  = require('url');
var assert = require('assert');

var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
//var mongourl = 'mongodb://asstudentnumber1:password123@ds119598.mlab.com:19598/comps381fproject';
var mongourl = 'mongodb://localhost:27017/test';


var session = require('cookie-session');
var express = require('express');
var fileUpload = require('express-fileupload');
var app = express();
var bodyParser = require('body-parser');

//middleware
app.use(session({cookieName: 'session',keys: ['MinMin','Kitty', 'Jessie']}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));
app.use(fileUpload());

app.get('/', function(req, res) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
		res.redirect('/read');
	}
});

app.get('/login', function(req, res) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
		res.redirect('/read');
	}
});

//login
/*app.post('/login', function(req, res) {
	var user = req.body.name;
	var pw = req.body.pw;	
	var criteria = {"name" : user};
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err,null);
		findUser(db, criteria, function(result) {
			if(result.name == user && result.password == pw) {
				req.session.authenticated = true;
				req.session.username = req.body.name;
			}
			res.sendFile(__dirname + '/public/login.html');
		});
	});
});*/
app.post('/login', function(req,res){
	//if (!req.session.authenticated) {
		req.session.authenticated = false;
		console.log(req.body.password+ ">>pw");console.log(req.body.name+ ">>name");
		var criteria = {"username": req.body.rname, "password": req.body.pw};
		MongoClient.connect(mongourl, function(err, db){
			assert.equal(null, err);
			findPassword(db, criteria, function(result){
				if(result == null){
					res.status(200).end('error ');
							
				}else{
					req.session.authenticated = true;
					req.session.username = req.body.name;
					console.log("Authenticated: " + req.session.authenticated + "; Username: " + req.session.username);
					//res.status(200).end('login successful');	
					res.redirect('/read');
				}		
			});
		});
	//}
	//res.status(200).end('go to restaurant page');
});


/**************************Function for Login******************************************/
function findPassword(db,criteria,callback){
	db.collection('user').findOne(criteria, function(err, result){
		assert.equal(err, null);
		callback(result);
	});
}


function findUser(db, criteria, callback) {
	db.collection('user').findOne(criteria, function(err, result) {
		assert.equal(err, null);
		callback(result);
	});
}

//logout
app.get('/logout', function(req, res, next) {
	req.session = null;
	res.redirect('/');
});

//list collections
app.get('/read', function(req, res) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
		var criteria = req.query;
		console.log("Authenticated: " + req.session.authenticated + "; Username: " + req.session.username);
 		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err,null);
			findRestaurant(db, criteria, function(dbres) {
				db.close();
				console.log(dbres+">>");
				res.render('list.ejs', {
					res:dbres,
					user:req.session.username,
					criteria:JSON.stringify(criteria)
				});
			});
		});
	}
});

function findRestaurant(db, criteria, callback) {
		var dbres = [];
		db.collection('res').find(criteria, function(err, result) {
			assert.equal(err, null);
			result.each(function(err, doc) {
				if (doc != null) {
					dbres.push(doc);
				}
				else {
					callback(dbres);
				}
			});
		});
}

//show details
app.get('/detail', function(req, res) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
		var target = req.query.id;
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err, null);
			findDetail(db, target, function(dbres) {
				db.close();
				res.render('show.ejs', {rest : dbres});
			});
		});
	}
});

function findDetail(db, target, callback) {
	db.collection('res').findOne({"_id" : ObjectId(target)}, function(err, result) {
		assert.equal(err, null);
		callback(result);
	});
}

//update information
app.get('/change', function(req, res) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err, null);
			changeInfo(db, req.query.id, function(result) {
				db.close();
				if (result.owner != req.session.username) {
					res.sendFile(__dirname + '/public/error.html');
				}
				else {
					res.render('change.ejs',{result:result});
				}
			});
		});
	}
});

function changeInfo(db, target, callback) {
	db.collection('res').findOne({"_id" : ObjectId(target)}, function(err, result) {
		assert.equal(err,null);
		callback(result);
	});
}

app.post('/change', function(req, res) {
	MongoClient.connect(mongourl, function(err, db) {
	assert.equal(null, err);
		checkName(db, req.body.name, function(result) {
			if(result == null) {
				res.sendFile(__dirname + '/public/error.html');
			}
			else {	
				commitChange(db, req.body.id, req.body.name, req.body.borough, req.body.cuisine, req.body.street, req.body.building, req.body.zipcode, req.body.lon, req.body.lat, req.files.sampleFile, function(result) {
			 		db.close();
					res.status(200);
					res.redirect('/detail?id=' + req.body.id);
				});
			}
		});
	});
});

function commitChange(db, id, name, borough, cuisine, street, building, zipcode, lon, lat, bfile, callback) {
	if (bfile.name != '') {
		db.collection('res').updateOne({"_id" : ObjectId(id)}, {
			$set : {
				"name" : name,
				"borough" : borough,
				"cuisine" : cuisine,
				"street" : street,
				"building" : building,
				"zipcode" : zipcode,
				"coor" : [lon,lat],
				"data" : new Buffer(bfile.data).toString('base64'),
				"mimetype" : bfile.mimetype
			}
		}, function(err,result) {
				if (err) {
					result = err;
					console.log("Update error: " + JSON.stringify(err));
				}
				callback(result);
			}
		);
	}
	else {
		db.collection('res').update({"_id" : ObjectId(id)}, {
			$set : {
				"name" : name,
				"borough" : borough,
				"cuisine" : cuisine,
				"street" : street,
				"building" : building,
				"zipcode" : zipcode,
				"coor" : [lon,lat]
			}
		}, function(err, result) {
				if (err) {
					result = err;
					console.log("Update error: " + JSON.stringify(err));
				}
				callback(result);
			}
		);
	}
}

function checkName(db, target, callback) {
	db.collection('res').findOne({"name" : target}, function(err, result) {
		assert.equal(err, null);
		callback(result);
	});
}

//rate
app.get('/rate', function(req, res) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {	
		var criteria = {"_id" : ObjectId(req.query.id)};
		console.log(req.query.id);
		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err, null);
			console.log(req.session.username);
			findOneRestaurant(db, criteria, function(result) { //console.log(result.rate[4].owner + ">>");
				var isRated = "0";
				var i = 0;
				console.log(result.rate);
				var record;
				record = result.rate;console.log(record);
				for (var i = 0; i<record.length; i++){ console.log(record[i].owner + ">>" + req.session.username); 
				if (record[i].owner == req.session.username){ 
					isReted = "1";
					console.log(result.rate.owner);
					res.status(400).end('cannot rating again');}}
				if(isRated != "1"){
					var resID = req.query.id;
					res.render('rate.ejs', {res : resID});
				}
			});
		});
		//var resID = req.query.id;
		//res.render('rate.ejs', {res : resID});
	}
});

app.post('/rate', function(req, res) {
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(err, null);
		addRate(db, req.query.id, req.body.score, req.session.username, function(result) {
			console.log(result);
			db.close();
			res.redirect('/read');
		});
	});
});


function isRating(db, userName, resID, callback){

	/*db.collection('user').findOne(criteria, function(err, result) {
		assert.equal(err, null);
		callback(result);
	});*/
	db.collection('res').find({ "_id": ObjectId(resID), "rate.owner": userName}, function(err, result) {
		assert.equal(err, null);
		callback(result);
	});
}

function addRate(db, resID, resScore, rateOwner, callback) {
	db.collection('res').update(
		{"_id" : ObjectId(resID)}, 
		{$push: {
			rate:{
				owner : rateOwner,
				score: resScore,
				isRated : "1"
			}
		}}, 
		function(err,result) {
			if (err) {
				result = err;
				console.log("update: " + JSON.stringify(err));
			}
		callback(result);
		}
	);
}

//display on map
app.get('/gmap', function(req, res) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
		res.render("map.ejs", {lat : req.query.lat, lon : req.query.lon, title : req.query.title});
	}
});

//add collections
app.get('/new', function(req, res) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
		res.sendFile(__dirname + '/public/create.html');
	}
});

app.post('/create', function(req, res) {
	var sampleFile;
	var criteria = {"name" : req.body.name};
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(null, err);
		findOneRestaurant(db, criteria, function(dbres) {
			//if(dbres == null) {
				create(db, req.session.username, req.body.name, req.body.borough, req.body.cuisine, req.body.street, req.body.building, req.body.zipcode, req.body.lon, req.body.lat, req.files.sampleFile, function(result) {
					db.close();
					if (result.insertedId != null) {
						res.status(200);
						res.sendFile(__dirname + '/public/finish.html');
				  	}
					else {
						res.status(500);
						res.end(JSON.stringify(result));
					}
				});
			//}
			//else {
			//	res.sendFile(__dirname + '/public/error.html');
			//}
		});
	});
});

/*function createRate(db, resID, callback){
	db.collection('rate').insertOne({
		"score": "",
		"owner": "",
		"resID": resID
	}, function(err, result) {
		if (err) {
			result = err;
			console.log("insertOne error: " + JSON.stringify(err));
		}
		else {
		  	console.log("status : OK,");
			console.log("_id : " + result.insertedId);
		}
		callback(result);
	});
}*/


function create(db, owner, name, borough, cuisine, street, building, zipcode, lon, lat, bfile, callback) {
	db.collection('res').insertOne({
		"owner" : owner,
		"borough" : borough,
		"name" : name,
		"cuisine" : cuisine,
		"street" : street,
		"building" : building,
		"coor" : [lon,lat],
		"data" : new Buffer(bfile.data).toString('base64'),
		"mimetype" : bfile.mimetype,
		"rate" : [{"owner": "", "isRated": "", "score": ""}]
		
	}, function(err, result) {
		if (err) {
			result = err;
			console.log("insertOne error: " + JSON.stringify(err));
		}
		else {
		  	console.log("status : OK,");
			console.log("_id : " + result.insertedId);
		}
		callback(result);
	});
}

//remove record
app.get('/remove', function(req, res, callback) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
		MongoClient.connect(mongourl, function(err, db) {
		assert.equal(null, err);
			findOneRestaurant(db, {"_id": ObjectId(req.query.id)}, function(result){ console.log(result.owner);
				if(result.owner == req.session.username){
					deleteRes(db, req.query.id, req.session.username, function(result2) {
						db.close();res.sendFile(__dirname + '/public/finish.html');
						//console.log(result2);
						/*if(result != null){
							res.sendFile(__dirname + '/public/finish.html');}
						else{
							res.status(400).end('you are not a owner');}*/
					});
				}else{res.status(400).end('you are not a owner');}


			});
			
		});
	}
});

function deleteRes(db,target,owner,callback) {
	db.collection('res').remove({"_id" : ObjectId(target), "owner" : owner}, function(err,result) {console.log(err+">>err1");
		if (err) {
			result = null;
			console.log(err+">>err");
			console.log(result+">>result");	callback(result);
		}
		callback(result);
		
	});


	
}

//register
app.get('/register', function(req, res, callback){
	res.sendFile(__dirname + '/public/register.html');
});

app.post('/register', function(req, res) {
	var criteria = {"name" : req.body.name};
	MongoClient.connect(mongourl, function(err, db) {
	assert.equal(null, err);
		findUser(db, criteria, function(result) {	
			if (result == null) {
				createUser(db, req.body.name, req.body.pw, function(result) {
					db.close();
					res.redirect('/');
				});
			}
			else {
				res.sendFile(__dirname + '/public/error.html');
			}
		});
	});
});

function createUser(db, name, pw, callback) {
	db.collection('user').insertOne({
		"name" : name,
		"password" : pw
	}, function(err,result) {
		assert.equal(null,err);
		callback(result);
	});
}

//read by api
app.get('/api/read/:field/:value', function(req, res) {
	if (!req.session.authenticated) {
		res.sendFile(__dirname + '/public/login.html');
	}
	else {
 		MongoClient.connect(mongourl, function(err, db) {
			assert.equal(err, null);	
			var field = req.params.field;
			var value = req.params.value;
			var criteria;
			if (field == "name")
				criteria = { "name" : value };
			if (field == "borough")
				criteria = { "borough" : value };
			if (field == "cuisine")
				criteria = { "cuisine" : value };
			findRestaurant(db, criteria, function(dbres) {
				db.close();
				res.end(JSON.stringify(dbres));
			});
		});
	}
});

//create by api
app.post('/api/create', function(req, res) {
	var criteria = {"name" : req.body.name};
	MongoClient.connect(mongourl, function(err, db) {
		assert.equal(null, err);
		findOneRestaurant(db, criteria, function(dbres) {
			if (dbres == null) {
				APIcreate(db, req.session.username, req.body.name, req.body.borough, req.body.cuisine, req.body.street, req.body.building, req.body.zipcode, req.body.lon, req.body.lat, function(result) {
					db.close();
					if (result.insertedId != null) {
						var str = '{status: ok, _id:'+result.insertedId+'}';
						res.end(JSON.parse(str));	
				  	}
					else {
						res.end(JSON.parse('{status: failed}'));
					}
				});
			}
			else {
				res.sendFile(__dirname + '/public/error.html');
			}
		});
	});
});

function APIcreate(db, owner, name, borough, cuisine, street, building, zipcode, lon, lat, callback) {
	db.collection('res').insertOne({
		"owner" : owner,
		"borough" : borough,
		"name" : name,
		"cuisine" : cuisine,
		"street" : street,
		"building" : building,
		"coor" : [lon,lat],
	}, function(err,result) {
		if (err) {
			result = err;
			console.log("insertOne error: " + JSON.stringify(err));
		}
		else {
		  	console.log("status : OK,");
			console.log("_id : " + result.insertedId);
		}
		callback(result);
	});
}

function findOneRestaurant(db, criteria, callback) {
	db.collection('res').findOne(criteria, function(err, result) {
		assert.equal(err, null);
		callback(result);
	});
}

app.listen(8099, function() {
	console.log('The server is waiting for request');
});

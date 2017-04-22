#!/usr/bin/env node
//////////////////////////
//Usage:
// (*nix) cat  NoCopyrightSounds.txt | node     NoCopyrightSounds.js > out
// (Win)  type NoCopyrightSounds.txt | node.exe NoCopyrightSounds.js > out.txt
"use strict";

var http          = require("http"),
	https         = require("https"),
	http2         = require("http2"),
	url           = require("url"),
	querystring   = require("querystring"),
	fs            = require("fs"),
	readline      = require("readline"),
	child_process = require("child_process");

var html_entitiesDecode = require("he").decode;	//https://mths.be/he

var latinize = (function(){
	//http://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript/37511463#37511463
	var unicodeCDM = /[\u0300-\u036f]/g;
	
	return function(str){
		return str.normalize("NFD").replace(unicodeCDM,"");
	};
})();

var sys = {
	put: function(str){//to avoid parse 'str' as format string (util.format()) in console.log()
		process.stdout.write(str + "\n"); //`${str}\n`
	}
};


var wrongHttpStatusCode = function(options, response, msg){
	sys.put("{ " + options.referers.join(" -> ") + " } " + msg + " [HTTP status code " + response.statusCode + "] " + (options.user_comment||""));
	//https://nodejs.org/api/stream.html#stream_compatibility_with_older_node_js_versions
	response.resume();	//consume response data to free up memory 
};

var problemWithRequest = (function(){
	var _reNewLine = /(?:\n|\r)/g;
	
	return function(options, e){
		sys.put("{ " + options.referers.join(" -> ") + " } " + "Problem with request [" + e.message.replace(_reNewLine, " ") + "] " + (options.user_comment||""));
	};
})();

var UserAgent = "Opera/9.80 (Macintosh; Intel Mac OS X 10.12.4; U; en) Presto/2.12.388 Version/12.15";
var http2Agent = new http2.Agent({settings: {SETTINGS_ENABLE_PUSH: 0}});
//SETTINGS_ENABLE_PUSH:
// https://www.daveyshafik.com/archives/69603-http2-server-push-youre-doing-it-all-wrong.html
// https://habrahabr.ru/post/221427/
//How-To set SETTINGS_ENABLE_PUSH in node-http2 (Epic way)?
// 0. see in wiki: https://github.com/molnarg/node-http2/wiki/Public-API/c5776172743767034ee02555a741dc6b81f84a9e ..No
// 1. find in repo: https://github.com/molnarg/node-http2/search?q=SETTINGS_ENABLE_PUSH&type=Code
// 2. return to wiki "http2.Endpoint: an API for using the raw HTTP/2 framing layer... see the lib/protocol/endpoint.js file"
// 3. see https://github.com/molnarg/node-http2/blob/v3.3.6/lib/protocol/endpoint.js
// 4. see https://github.com/molnarg/node-http2/blob/v3.3.6/HISTORY.md#100-2013-09-23
//    "Exporting Endpoint class" :)
// 4. see https://github.com/molnarg/node-http2/blob/v3.3.6/HISTORY.md#200-2013-11-09 
//    "the  Endpoint  class is not exported anymore. Use the http2-protocol module if..." :(
// 5. goto https://github.com/molnarg/node-http2-protocol/tree/v0.13.0
//    "WARNING: This code was merged into node-http2"  >_<
// 6. see https://github.com/molnarg/node-http2-protocol/blob/v0.13.0/example/client.js#L26 (too low level)
// 7. return to node-http2 ...
// 8. find "new Endpoint(" https://github.com/molnarg/node-http2/search?q=%22new+Endpoint%28%22&type=Code
// 9. return to wiki "Class: http2.Agent ... agent.endpoints: contains Endpoint objects for HTTP/2 connections"
//11. "new Endpoint(self._log, 'CLIENT', self._settings);" https://github.com/molnarg/node-http2/blob/v3.3.6/lib/http.js#L998
//10. find self._settings set place https://github.com/molnarg/node-http2/blob/v3.3.6/lib/http.js#L884 "this._settings = options.settings"
//12. find settings format:
//13. https://github.com/molnarg/node-http2/blob/v3.3.6/lib/protocol/endpoint.js#L68
//14. https://github.com/molnarg/node-http2/blob/v3.3.6/lib/protocol/endpoint.js#L186
//15. https://github.com/molnarg/node-http2/blob/v3.3.6/lib/protocol/connection.js#L56
//16. https://github.com/molnarg/node-http2/blob/v3.3.6/lib/protocol/connection.js#L412
//17. https://github.com/molnarg/node-http2/blob/v3.3.6/lib/protocol/connection.js#L463
//18. ...
//19. https://github.com/molnarg/node-http2/blob/v3.3.6/lib/protocol/framer.js#L547
//20. https://github.com/molnarg/node-http2/blob/v3.3.6/lib/protocol/framer.js#L601

var downloadFrom = {
	"ncs.lnk.to": (function(){
		var _reHiveCo = /https:\/\/www\.hive\.co\/[^"]+/;
		
		return function(options, callback){
			options.url.headers = {
				"User-Agent": UserAgent,
				"Referer": options.referers[options.referers.length-1]
			};
			options.url.protocol = "https:";
			
			https.get(options.url, function(response){
				if(response.statusCode !== 200){
					wrongHttpStatusCode(options, response, "Can't get " + options.url.href);
					return;
				}
				
				var _request = this;
				options.referers.push(options.url.href);
				
				readline.createInterface({
					input: response
				}).on("line", function F(line){
					var lineContain = line.match(_reHiveCo);
					if(!lineContain) return;
					
					this.removeListener("line", F);	//avoid recive other lines in buf
					_request.abort();
					this.close();	//fast close
					
					_request = null;	//:-)
					
					// go to hive.co handler --->>>
					options.url = url.parse(lineContain[0]);
					downloadFrom["www.hive.co"](options, callback);
				});
				
				response = null;	//:-)
			}).on("error", function(e){ problemWithRequest(options, e); });
		};
	})(),
	"www.hive.co": (function(){
		//CONFIGURE: (and rename "Cvar" to "var")
		//> _COOKIE:
		//  1. open any composition on www.hive.co (for example https://www.hive.co/l/25yhu )
		//  2. open DevTools (Cmd+Opt+I or Ctrl+Shift+I)
		//  3. click to "Signup via email" (little link next to Download button)
		//  4. fill the form, Continue
		//  5. copy "sessionid" cookie (in Chrome DevTools: Application (tab) > Storage (group on left) > Cookies > "https://www.hive.co"
		//                                                  or Network (tab) > see "Set-Cookie" response header)
		Cvar _COOKIE = "sessionid=<id>"; //example: "sessionid=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"
		
		var _reHiveCoDownId = /\d+(?=\/spotlight\/)/;
		
		return function(options, callback){
			options.url.headers = {
				"User-Agent": UserAgent,
				"Referer": options.referers[options.referers.length-1],
				"Cookie": _COOKIE
			};
			options.url.protocol = "http:";
			
			http.get(options.url, function(response){
				if(response.statusCode !== 302){
					if(!options.url.pathname.match(_reHiveCoDownId)){ //callback-hack, if options.url already contain full URL (https://ncs.lnk.to/223)
						wrongHttpStatusCode(options, response, "Can't get " + options.url.href);
						return;
					}else response.headers["location"] = options.url.href;
				}
				
				response.resume();	//consume response data to free up memory 
				options.referers.push(options.url.href);
				
				//===========================================================
				var _referer = response.headers["location"];	//https://www.hive.co/downloads/download/491867/spotlight/
				var _downloadId = _referer.match(_reHiveCoDownId)[0];
				
				var postData = querystring.stringify({
					"downloadId": _downloadId
				});
				
				https.request({
					method: "POST", path: "/api/downloads/download/instance/create/",
					hostname: "www.hive.co",
					headers: {
						"User-Agent": UserAgent,
						"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
						"Referer": _referer,
						"Cookie": _COOKIE,
						"Content-Length": Buffer.byteLength(postData)
					}
				}, function(response){
					if(response.statusCode !== 200){
						wrongHttpStatusCode(options, response, "Can't post/create " + _referer);
						return;
					}
					
					response.resume();	//consume response data to free up memory 
					
					//=========================================================
					https.get({
						path: "/downloads/download/"+_downloadId+"/done/",
						hostname: "www.hive.co",
						headers: {
							"User-Agent": UserAgent,
							"Referer": _referer,
							"Cookie": _COOKIE
						}
					}, function(response){
						if(response.statusCode !== 302){
							wrongHttpStatusCode(options, response, "Can't get/done " + _referer);
							return;
						}
						
						response.resume();	//consume response data to free up memory
						options.referers.push(_referer);
						
						//=====================================================
						options.url = url.parse(response.headers["location"]);
						
						response = null;	//:-)
						
						// download --->>>
						callback(options);
					});
					
					response = null;	//:-)
				}).on("error", function(e){
					problemWithRequest(options, e);
				}).end(postData);
				
				postData = response = null;	//:-)
			}).on("error", function(e){ problemWithRequest(options, e); });
		}
	})(),
	"bit.ly": function(options, callback){
		//Waysons – Daydream [NCS Release] -> http://bit.ly -> http://nocopyrightsounds.co.uk -> http://files-cdn.nocopyrightsounds.co.uk/Waysons%20-%20Daydream.mp3
		
		options.url.headers = {
			"User-Agent": UserAgent,
			"Referer": options.referers[options.referers.length-1]
		};
		
		http.get(options.url, function(response){
			if(response.statusCode !== 301){
				wrongHttpStatusCode(options, response, "Can't get " + options.url.href);
				return;
			}
			
			response.resume();	//consume response data to free up memory
			options.referers.push(options.url.href);
			
			
			options.url = url.parse(response.headers["location"]);
			
			response = null;	//:-)
			
			// go to * handler OR to nocopyrightsounds.co.uk handler --->>>
			downloadFrom[downloadFrom.hasOwnProperty(options.url.hostname) ? options.url.hostname : "nocopyrightsounds.co.uk"](options, callback);
			
		}).on("error", function(e){ problemWithRequest(options, e); });
	},
	"nocopyrightsounds.co.uk": function(options, callback){
		//Waysons – Daydream [NCS Release] -> http://bit.ly -> http://nocopyrightsounds.co.uk -> http://files-cdn.nocopyrightsounds.co.uk/Waysons%20-%20Daydream.mp3
		options.referers.push(options.url.href);
		
		options.url = url.parse("http://files-cdn.nocopyrightsounds.co.uk/"+encodeURIComponent(options.title)+".mp3");
		
		// download --->>>
		callback(options);
	},
	"www.toneden.io": (function(){
		//Need connect to active account on SoundCloud/...
		
		//Example "bvd kult - Made Of Something (feat. Will Heggadon)":
		//Referer:  https://www.toneden.io/nocopyrightsounds/post/made-of-something
		//GET https://www.toneden.io/api/v1/posts?author_username=nocopyrightsounds&link_path=made-of-something
		// JSON -> post.id = 5791134, post.platform = "soundcloud"
		//POST https://www.toneden.io/api/v1/attachments/5791134/unlock  POST-Data: {"platform":"soundcloud","optedOutFanID":7777777}
		// JSON -> gateStatus.download_url
		//
		//PS. if GET https://www.toneden.io/api/v1/attachments/5791134/gateMetadata
		//     JSON -> metadata.is_gate_open === true ?
		//    GET https://www.toneden.io/api/v1/attachments/5791134/download
		
		//CONFIGURE: (and rename "Cvar" to "var")
		//> _COOKIE & _FANID:
		//  1. login to SoundCloud
		//  2. open any composition on www.toneden.io (for example https://www.toneden.io/nocopyrightsounds/post/made-of-something )
		//  3. open DevTools (Cmd+Opt+I or Ctrl+Shift+I)
		//  4. open Network tab in DevTools
		//  5. click to "Download" button (on the page)
		//  6. click to "No thanks, I want to download without an account." (little dark link)
		//  7. click to "Support on soundcloud"
		//  8. accept "Connect and Continue"
		//  9. open another composition (for example https://www.toneden.io/nocopyrightsounds/post/over-again )
		// 10. click to "Support on soundcloud"
		// 11. in DevTools (Network tab) find "/unlock" request (POST, XHR, "https://www.toneden.io/api/v1/attachments/5802814/unlock"), open it
		// 12. copy "optedOutFanID" (_FANID) from Request Payload AND copy cookies (_COOKIE): "__cfduid", "express:sess", "express:sess.sig"
		Cvar _COOKIE = "__cfduid=<id>; express:sess=<sess>; express:sess.sig=<sig>";
		Cvar _FANID = 7777777;
		
		var _reTonedenIoPath = /[^$]+\/([^\/]+)$/; //group: 1
		
		return function(options, callback){
			var _reqOptions = {
				method: "GET", path: "/api/v1/posts?author_username=nocopyrightsounds&link_path=" + options.url.pathname.match(_reTonedenIoPath)[1],
				hostname: "www.toneden.io",
				headers: {
					"User-Agent": UserAgent,
					"Referer": options.url.href,
					"Cookie": _COOKIE
				}
			};//P.S. really like it X-Nerd-Alert header ;)
			
			options.referers.push(options.url.href);
			
			https.get(_reqOptions, function(response){
				if(response.statusCode !== 200){
					wrongHttpStatusCode(options, response, "Can't get " + (_reqOptions.hostname+"/"+_reqOptions.path));
					return;
				}
				
				var _body = "";
				response.setEncoding("utf8").on("data", function(chunk){
					_body += chunk;
					//or (slower?) Buffer.concat():
					//https://nodejs.org/en/docs/guides/anatomy-of-an-http-transaction/#request-body
					//http://stackoverflow.com/questions/7296594/array-join-vs-string-concat/7296616#7296616
				}).on("end", function(){
					var _post = JSON.parse(_body).post;
					
					_reqOptions.path = "/api/v1/attachments/" + _post.id + "/unlock";
					_reqOptions.method = "POST";
					
					var postData = querystring.stringify({
						"platform": _post.platform,
						"optedOutFanID": _FANID
					});
					
					https.request(_reqOptions, function(response){
						if(response.statusCode !== 200){
							wrongHttpStatusCode(options, response, "Can't unlock " + (_reqOptions.hostname+"/"+_reqOptions.path) + " [account on " + _post.platform + " is valid?]");
							return;
						}
						
						var _body = "";
						response.setEncoding("utf8").on("data", function(chunk){
							_body += chunk;
						}).on("end", function(){
							var gateStatus = JSON.parse(_body).gateStatus;
							
							if(gateStatus.is_gate_open !== true){
								sys.put("{ " + options.referers.join(" -> ") + " } Can't download from www.toneden.io " + (options.user_comment||""));
								return;
							}
							
							options.url = url.parse(gateStatus.download_url);
							
							_body = gateStatus = null;	//:-)
							
							// download --->>>
							callback(options);
						});
						
						_post = response = null;	//:-)
					}).on("error", function(e){
						problemWithRequest(options, e);
					}).end(postData);
					
					_body = postData = null;	//:-)
				});
				
				response = null;	//:-)
			}).on("error", function(e){ problemWithRequest(options, e); });
		}
	})()
};

var saveIt = (function(){
	var _http = {
		"http:" : http,
		"https:": https
	};
	
	var _reFileName = /filename="([^"\/\\:*?<>|]+)"/;
	var _reFileNameClear = /[\/\\:*?<>|\[\]]/g; //"[" & "]" to https://github.com/squell/id3 embedded pattern matching mitigation
	var _reArtistTitle = /^(.+?)\s*-\s*(.+)\.mp3$/;
	var _reNewLine = /(?:\n|\r)/g;
	
	return function(options){
		options.url.headers = {
			"User-Agent": UserAgent,
			"Referer": options.referers[options.referers.length-1]
		};
		
		var _errHappened = false;
		
		_http[options.url.protocol].get(options.url, function(response){
			if(response.statusCode !== 200){
				wrongHttpStatusCode(options, response, "Can't save " + options.url.href);
				return;
			}
			
			options.referers.push(options.url.href);
			
			var containFileName = response.headers["content-disposition"] && 
			                      response.headers["content-disposition"].match(_reFileName);
			var _fileName = decodeURIComponent(containFileName ? containFileName[1] : options.title+".mp3").replace(_reFileNameClear, "_");
			
			var _artist_title = _fileName.match(_reArtistTitle);
			if(!_artist_title){
				_artist_title = (decodeURIComponent(options.title)+".mp3").match(_reArtistTitle);
			}
			
			//NOTE: _filePath && _filePathTemp must point to the same storage
			// https://github.com/nodejs/node-v0.x-archive/issues/2703
			var _filePath     = "./music/" + _fileName;
			var _filePathTemp = "./music/" + _fileName + ".download";
			
			response.pipe(fs.createWriteStream(_filePathTemp).on("error", function(e){
				sys.put("{ " + options.referers.join(" -> ") + " } Write '" + _fileName + "' error [" + e.message.replace(_reNewLine, " ") + "] " + (options.user_comment||""));
			}).on("close", function(){
				if(_errHappened) return;
				
				// ffmpeg can't add proper COMM tag
				//child_process.execFile("./ffmpeg", [//https://wiki.multimedia.cx/index.php?title=FFmpeg_Metadata#MP3
				//	"-i", _filePathTemp,
				//	"-c", 'copy', //not re-encode http://ffmpeg.org/ffmpeg.html#Stream-copy
				//	"-id3v2_version", '3',
				//	"-metadata", 'album=NoCopyrightSounds',
				//	"-metadata", 'artist=' + _artist_title[1],
				//	"-metadata", 'title='  + _artist_title[2],
				//	"-metadata", 'comment=' + options.comment,	//Not recognize "comment" as "COMM" tag
				//	"-n", _filePath //dont overwrite output files
				//], function(e){
				//	if(e){
				//		sys.put("{ " + options.referers.join(" -> ") + " } Error in ID3 tag editor, file '" + _fileName + ".download' [" + e.message.replace(_reNewLine, " ") + "] " + (options.user_comment||""));
				//	}else{
				//		fs.unlink(_filePathTemp, function(e){ //delete temp file
				//			if(!e) sys.put("Downloaded " + _fileName);
				//			else sys.put("All done, but I can't delete '" + _fileName + ".download' [" + e.message.replace(_reNewLine, " ") + "]");
				//		});
				//	}
				//});
				
				child_process.execFile("./id3", [//https://github.com/squell/id3
					"-2", //ID3v2.3
					"-l", 'NoCopyrightSounds',      //album
					"-a", _artist_title[1],         //artist
					"-t", _artist_title[2],         //title
					"-wCOMM::eng", options.comment, //comment
					"-c", options.comment,          //comment-dub for compatibility (Windows; ISO-639-2 language code set to "xxx")
					"--", _filePathTemp
				], function(e){
					if(e){
						sys.put("{ " + options.referers.join(" -> ") + " } Error in ID3 tag editor, file '" + _fileName + ".download' [" + e.message.replace(_reNewLine, " ") + "] " + (options.user_comment||""));
						return;
					}
					
					fs.access(_filePath, function(e_not_exist){ //not rename if exist http://stackoverflow.com/a/21219139
						if(!e_not_exist){
							sys.put("All done, but file '" + _fileName + "' already exists. New file saved as '" + _fileName + ".download'.");
							return;
						}
						
						//Mithgol https://github.com/nodejs/node-v0.x-archive/issues/2703
						fs.rename(_filePathTemp, _filePath, function(e){
							if(!e) sys.put("Downloaded " + _fileName);
							else sys.put("All done, but I can't rename '" + _fileName + ".download' [" + e.message.replace(_reNewLine, " ") + "]");
						});
						
					});
				});
				
				//other solutions:
				//https://github.com/egoroof/browser-id3-writer
				//https://github.com/Zazama/node-id3
			}));
			
			response = containFileName = null;	//:-)
		}).on("error", function(e){ _errHappened = true; problemWithRequest(options, e); });
	};
})();

//Wait for connect (new Endpoint()):
// https://github.com/molnarg/node-http2/blob/v3.3.6/lib/http.js#L1014
// https://github.com/molnarg/node-http2/blob/v3.3.6/lib/http.js#L925
//if no wait then node-http2 establish multiple connections to server:
// https://github.com/molnarg/node-http2/blob/v3.3.6/lib/http.js#L933
http2Agent.once("false:www.youtube.com:443", function(endpoint){
	var _options = {
		hostname: "www.youtube.com",
		headers: {
			"User-Agent": UserAgent,
			"Referer": "https://www.youtube.com/user/NoCopyrightSounds"
		}
	};
	
	// compilled/cached RegExp vs string search performance:
	//http://jsben.ch/#/r9hBp
	//https://jsperf.com/substring-test
	//https://jsperf.com/substring-test/3
	
	// To prevent Infinite backtracking RegExp problem:
	//http://javascript.info/regexp-infinite-backtracking-problem
	
	// Use https://regex101.com Regex Debugger
	
	var _reVideoId = /[?&]v=([^&\s]+)/; //group: 1
	var _reVideoUserComment = /\(([^)]+)\)\s*$/; //group: 1
	var _reVideoTitle = /<title>([^<]+)\s\[NCS Release\]/; //group: 1
	var _reVideoDescription = /^(?=(\s*<div [^>]*?id="))\1action-panel-details"(?=(.+?id="eow-description"[^>]*>))\2(.+<\/p>)/; //group: 3
	var _reDownURL = /\bfree\b[^<]*<a[^>]+?href="([^"]+)/i; //group: 1
	var _reComment = /^(?=([^▬]+▬+))\1[^▬]+<br[\s\/>]+<br\s*\/>([^▬]+)/; //group: 2
	var _reLink = /<\/a>/;
	var _reAllBrTag = /<br[^>]*>/g;
	var _reAllTag = /<[^>]+>/g;
	var _reAllHttpDub = /(\bhttps?:\/\/)\1/g; //group: 1
	
	var _lineNum = 0;
	var _fileRead = false;
	var _steamsCount = 0;
	
	readline.createInterface({
		input: process.stdin//fs.createReadStream("NoCopyrightSounds.txt")
	}).on("line", function(line){
		_lineNum++;
		
		var lineContain = line.match(_reVideoId);
		if(!lineContain){
			sys.put("Line #" + _lineNum + " not contain YouTube URL.");
			return;
		}
		
		var _videoId = lineContain[1];
		_options.path = "/watch?v=" + _videoId;
		
		lineContain = line.match(_reVideoUserComment);
		var _userComment = lineContain && "("+lineContain[1]+")";
		
		_steamsCount++;
		https.get(_options, function(response){
			if(response.statusCode !== 200){
				wrongHttpStatusCode({referers:[], user_comment:_userComment}, response, "Can't get https://www.youtube.com/watch?v=" + _videoId);
				return;
			}
			
			var _request = this;
			var _videoTitle = "";
			
			//or use https://github.com/fb55/htmlparser2  http://stackoverflow.com/a/7978072
			readline.createInterface({
				input: response
			}).on("line", function F(line){	//https://javascript.info/function-object#named-function-expression
				var lineContain = line.match(_reVideoTitle);
				if(!lineContain) return;
				
				this.removeListener("line", F);
				_videoTitle = html_entitiesDecode(latinize(lineContain[1]));
				
			}).on("line", function F(line){
				var lineContain = line.match(_reVideoDescription);
				if(!lineContain) return;
				
				this.removeListener("line", F);	//avoid recive other lines in buf
				_request.abort();
				this.close();	//fast close
				
				_request = null;	//:-)
				
				////////////////////////////////////////////////////////////////////////////////////////////////////////////
				var videoDescription = lineContain[3];
				
				var containDownURL = videoDescription.match(_reDownURL);
				if(!containDownURL){
					if(_videoTitle == ""){
						sys.put("https://youtu.be/"+_videoId+" > can't find URL for download " + (_userComment||""));
						return;
					}
					
					sys.put("https://youtu.be/"+_videoId+" > can't find URL for download, try to download from nocopyrightsounds.co.uk " + (_userComment||""));
					containDownURL = [undefined, "http://null.null/dev"];
				}
				var downUrl = url.parse(containDownURL[1]);
				
				var containComment = videoDescription.match(_reComment);
				var comment = ( containComment && containComment[2].search(_reLink)>-1 && 
								containComment[2].replace(_reAllBrTag,"\n").
												  replace(_reAllTag,"").
												  replace(_reAllHttpDub,"$1")
							  ) || //Mix of:
							       //+http://nocopyrightsounds.co.uk/user-license/
								   //+https://youtu.be/YJ_hqYDe0ss
								   //+https://youtu.be/8cuMg3Hqxzo
								   //+https://youtu.be/vpvytpRa_tQ
								   //+https://youtu.be/cvl8e2se8Q4
							  "Music Provided by NoCopyrightSounds\n" + 
							  "Song: " + _videoTitle + " [NCS Release]\n" + 
							  "Video Link: https://youtu.be/" + _videoId + "\n"
				
				////////////////////////////////////////////////////////////////////////////////////////////////////////////
				downloadFrom[downloadFrom.hasOwnProperty(downUrl.hostname) ? downUrl.hostname : "nocopyrightsounds.co.uk"]({
					url: downUrl,
					referers: ["https://www.youtube.com/watch?v=" + _videoId],
					title: _videoTitle,
					user_comment: _userComment
				}, function(options){
					options.comment = (_userComment ? _userComment+"\n" : "") + comment;
					saveIt(options);
				});
				///////////////////////////////////////////////////////////////////////////////////////////////////////////
				
			}).on("close", function(){
				_steamsCount--;
				
				if(_fileRead && _steamsCount <= 0){
					endpoint.close();	//it not destroy the socket https://github.com/molnarg/node-http2/issues/203
					//http2Agent.destroy();
				}
			});
			
			response = null;	//:-)
		}).on("close", function(){
			if(_fileRead && _steamsCount <= 0){
				//endpoint.close();	//it not destroy the socket, if uncomment: "Error: This socket is closed"
				endpoint.socket.destroy();
			}
		}).on("error", function(e){ problemWithRequest({referers:["https://www.youtube.com/watch?v=" + _videoId], user_comment:_userComment}, e); });
		
		lineContain = null;	//:-)
	}).on("close", function(){
		_fileRead = true;
	});
});

//Init connect
http2.request({
	method: "HEAD", path: "/user/NoCopyrightSounds",
	hostname: "www.youtube.com",
	headers: {
		"User-Agent": UserAgent
	},
	agent: http2Agent
}, function(response){
	if(response.statusCode !== 200){
		sys.put("Can't init connect to YouTube [HTTP status code " + response.statusCode + "]");
	}
	
	response.resume();
});

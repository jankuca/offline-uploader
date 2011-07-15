/**
 * @preserve
 * Offline Uploader
 * --
 * Ultimate solution to file uploads
 * Does not require Internet connection in modern browsers.
 * Falls back to classic multipart POST uploads in older ones.
 * --
 * @author Jan Kuca <jan@jankuca.com>, http://jankuca.com
 *
 * @licence Creative Commons 3.0 Attribution/Share-alike Unported Licence
 *   "As long as you keep this comment, you're fine."
 *
 */


(function (global) {
	"use strict";


	/**
	 * @interface
	 * @param {HTMLFormElement} form_el The root <form> element
	 * @param {Object=} params Various parameters
	 */
	function IOfflineUploader(form_el, params) {}

	/**
	 * Initializes the component
	 */
	IOfflineUploader.prototype['init'] = function () {};

	/**
	 * Destroys the component
	 * The original HTML structure remains.
	 */
	IOfflineUploader.prototype['destroy'] = function () {};

	/**
	 * Adds an event listener
	 *
	 * @param {string} type Event type to listen for
	 * @param {function(Event)} listener Event listener function
	 * @param {Object=} ctx The context to call the listener in
	 * @throws Error
	 */
	IOfflineUploader.prototype['on'] = function (type, listener, ctx) {};

	/**
	 * Enables the component
	 */
	IOfflineUploader.prototype['enable'] = function () {};

	/**
	 * Disables the component
	 */
	IOfflineUploader.prototype['disable'] = function () {};

	/**
	 * Is the component disabled?
	 *
	 * @type {boolean}
	 */
	IOfflineUploader.prototype.disabled;

	/**
	 * Various parameters
	 *
	 * @type {Object}
	 */
	IOfflineUploader.prototype.params;

	/**
	 * A storage API
	 *
	 * @type {IOfflineStorage}
	 */
	IOfflineUploader.prototype.storage;


	/**
	 * @interface
	 * @param {Object=} params Various parameters
	 */
	function IOnlineUploader(params) {}

	/**
	 * Uploads base64-encoded file contents via XMLHttpRequest
	 *
	 * @param {string} name A file name
	 * @param {string} data Base64-encoded file contents
	 * @param {function(Error)=} callback A function to be called when finished
	 */
	IOnlineUploader.prototype['uploadBase64'] = function (name, data, callback) {};


	/**
	 * @interface
	 * @param {Object} params Various parameters
	 */
	function IOfflineStorage(params) {}

	/**
	 * Estabilishes a connection to the storage
	 *
	 * @param {function(Error)=} callback A callback function
	 */
	IOfflineStorage.prototype['connect'] = function (callback) {};

	/**
	 * Closes the connection to the storage
	 *
	 * @param {function(Error)=} callback A callback function
	 */
	IOfflineStorage.prototype['disconnect'] = function (callback) {};

	/**
	 * Handles base64-encoded file contents
	 *
	 * @param {!File} file A file
	 * @param {string} data Base64-encoded file contents
	 * @param {function(Error)=} callback A callback function
	 */
	IOfflineStorage.prototype['store'] = function (file, data, callback) {};


	var __slice = Array.prototype.slice;
	var _bind = function (fn, ctx) {
		try {
			return fn.bind(ctx);
		} catch (err) {
			return function () {
				return fn.apply(ctx, __slice.call(arguments));
			};
		}
	};


	/**
	 * Is IndexedDB supported?
	 *
	 * @const
	 * @type {boolean}
	 */
	var INDEXEDDB_SUPPORT = ('indexedDB' in window)
		|| ('webkitIndexedDB' in window) || ('mozIndexedDB' in window);

	/**
	 * Is Web SQL supported
	 *
	 * @const
	 * @type {boolean}
	 */
	var WEBSQL_SUPPORT = ('openDatabase' in window);

	/**
	 * Is File API supported?
	 *
	 * @const
	 * @type {boolean}
	 */
	var FILEAPI_SUPPORT = ('FileReader' in window)
		&& ('files' in window.document.createElement('input'));
	
	/**
	 * Are all standards required for offline usage supported?
	 *
	 * @const
	 * @type {boolean}
	 */
	var OFFLINE_SUPPORT = (INDEXEDDB_SUPPORT || WEBSQL_SUPPORT)
		&& FILEAPI_SUPPORT;
	
	/**
	 * Is drag&dropping supported?
	 *
	 * @const
	 * @type {boolean}
	 */
	var DRAGANDDROP_SUPPORT = ('ondrop' in window.document.body);

	/**
	 * Is the user using Internet Explorer?
	 *
	 * @const
	 * @type {boolean}
	 */
	var IE = (navigator.userAgent.search('MSIE') !== -1);


	/**
	 * @constructor
	 * @implements {IOfflineUploader}
	 */
	var OfflineUploader = function (form_el, params) {
		params = params || {};
		this.params = {
			'ns': params['ns'] || 'uploader',
			'store': params['store'] || 'files',
			'api': params['api'] || form_el.action,
			'drop': null
		};

		if (params['drop'] === true) {
			this.params['drop'] = form_el;
		} else if (params['drop'] instanceof Element) {
			this.params['drop'] = params['drop'];
		}

		this.listeners = {
			'beforequeue': [],
			'queuesuccess': [],
			'queuefailure': [],
			'queueempty': [],
			'uploading': [],
			'uploadsuccess': [],
			'uploadfailure': [],
			'dragenter': [],
			'dragover': [],
			'dragleave': [],
			'drop': []
		};

		this.form_el = form_el;
		this.span_el = form_el.getElementsByTagName('span').item(0);
		this.input_el = form_el.getElementsByTagName('input').item(0);
		this.button_el = form_el.getElementsByTagName('button').item(0);
		this.iframe_el = form_el.getElementsByTagName('iframe').item(0);

		this.disabled = true;
		this.offline = (params['offline'] === false) ? false : OFFLINE_SUPPORT;
	};

	OfflineUploader.prototype.storage = null;

	OfflineUploader.prototype['init'] = function () {
		this.addListeners();
		if (this.offline) {
			this.connectStorage(_bind(function (err) {
				if (err) {
					this.offline = false;
					this['enable']();
				} else {
					this['enable']();
				}
			}, this));
		} else {
			this['enable']();
		}
	};

	OfflineUploader.prototype['destroy'] = function () {
		this.removeListeners();
		if (this.offline) {
			this.disconnectStorage();
		}
	};

	OfflineUploader.prototype['on'] = function (type, listener, ctx) {
		try {
			this.listeners[type].push([
				listener,
				ctx !== void 0 ? ctx : this
			]);
		} catch (err) {
			throw new Error('Unknown event type');
		}
	};

	OfflineUploader.prototype['enable'] = function () {
		this.disabled = false;
		this.input_el.disabled = false;
		this.button_el.disabled = false;
		this.form_el.className = this.form_el.className.replace(/(^|\s+)disabled(\s+|$)/, ' ');
	};

	OfflineUploader.prototype['disable'] = function () {
		this.disabled = true;
		this.input_el.disabled = true;
		this.button_el.disabled = true;
		this.form_el.className += ' disabled';
	};

	/**
	 * Changes the label of the component
	 *
	 * @param {string} label The label to show
	 */
	OfflineUploader.prototype.label = function (label) {
		this.span_el.textContent = label;
		this.span_el.innerText = label;
	};

	/**
	 * Updates the component state when classic upload finishes.
	 *
	 * @param {*} data Server response body; JSON gets converted to an actual Object
	 */
	OfflineUploader.prototype.confirm = function (data) {
		this.label('Upload a file');
		this['enable']();

		this.fire('uploadsuccess', data);
	};

	/**
	 * Initializes the upload process
	 */
	OfflineUploader.prototype.upload = function () {
		if (FILEAPI_SUPPORT && this.storage && this.offline) {
			var files = this.input_el.files;
			if (files.length !== 0) {
				this['disable']();
				this.uploadFiles(files);
			}
		} else {
			var value = this.input_el.value;
			if (value) {
				this.beginUploading();
				this.form_el.submit();
			}
		}
	};

	/**
	 * Gets file contents via File API and stores them in the database
	 *
	 * @param {FileList} files The file list to store
	 */
	OfflineUploader.prototype.uploadFiles = function (files) {
		var _max = files.length - 1;
		Array.prototype.forEach.call(files, function (file, i) {
			if (!this.fire('beforequeue', file)) {
				this['enable']();
				return;
			}
			var reader = new FileReader();
			reader.onloadend = _bind(function () {
				this.storage['store'](file, reader.result, _bind(function (err) {
					if (err) {
						this.fire('queuefailure', file.name);
					} else {
						this.fire('queuesuccess', file.name);
					}
					this['enable']();
				}, this));
			}, this);
			reader.readAsDataURL(file);
		}, this);
	};

	/**
	 * Fires an event
	 *
	 * @private
	 * @param {string} type Event type
	 * @param {*=} detail Additional data
	 * @return {boolean} Whether the event was successful
	 * @throws Error
	 */
	OfflineUploader.prototype.fire = function (type, detail) {
		var listeners = this.listeners[type];
		if (listeners === void 0) {
			throw new Error('Unknown event type');
		}
		return listeners.every(function (listener) {
			return (listener[0].call(listener[1], detail) !== false);
		});
	};

	/**
	 * Connects a storage
	 *
	 * @private
	 * @param {function(Error)} callback A callback function
	 */
	OfflineUploader.prototype.connectStorage = function (callback) {
		if (!this.storage) {
			if (INDEXEDDB_SUPPORT) {
				this.storage = new IndexedDBStorage(this.params);
			} else if (WEBSQL_SUPPORT) {
				this.storage = new WebSQLStorage(this.params);
			}
		}
		if (this.storage && this.storage.connect) {
			this.storage.connect(_bind(function (err) {
				if (err) {
					this.offline = false;
					this['enable']();
				}
				if (typeof callback === 'function') {
					callback(err || null);
				}
			}, this));
		} else if (this.storage) {
			if (typeof callback === 'function') {
				callback(null);
			}
		} else if (typeof callback === 'function') {
			callback(new Error('No storage available'));
		}
	};

	/**
	 * Disconnects the storage
	 */
	OfflineUploader.prototype.disconnectStorage = function () {
		if (this.storage && this.storage.disconnect) {
			this.storage.disconnect();
		}
	};

	/**
	 * Adds event listeners/handlers to DOM elements
	 */
	OfflineUploader.prototype.addListeners = function () {
		if (IE) {
			this.addIEListeners();
		} else {
			this.addStandardListeners();
		}

		this.addDragAndDropListeners();
	};

	/**
	 * Adds event listeners/handlers to DOM elements for IE
	 *
	 * Due to the fact that IE doesn't allow us to call HTMLFormElement.submit
	 * in most situations, we need to let the user choose a file just before
	 * submitting the form. The dialog pauses script execution.
	 */
	OfflineUploader.prototype.addIEListeners = function () {
		this.button_el.onclick = _bind(function () {
			this.input_el.click();

			if (FILEAPI_SUPPORT) {
				this.upload();
				return false;
			}
		}, this);
		if (!FILEAPI_SUPPORT) {
			this.form_el.onsubmit = _bind(function (e) {
				var value = this.input_el.value;
				if (!value) {
					return false;
				}
				this.beginUploading();
				return true;
			}, this);
		}
	};

	/**
	 * Adds event listeners/handler to DOM elements for standard-complaint browsers
	 */
	OfflineUploader.prototype.addStandardListeners = function () {
		this.form_el.onclick = _bind(function () {
			this.input_el.click();
		}, this);
		this.input_el.onchange = _bind(function () {
			this.upload();
		}, this);
	};

	/**
	 * Adds drag&drop event listeners/handler to DOM elements
	 */
	OfflineUploader.prototype.addDragAndDropListeners = function () {
		var target = this.params['drop'];

		if (target && DRAGANDDROP_SUPPORT && FILEAPI_SUPPORT) {
			target['ondragenter'] = _bind(function (e) {
				e.preventDefault();
				if (!this.disabled) {
					this.fire('dragenter');
				}
			}, this);
			target['ondragleave'] = _bind(function (e) {
				e.preventDefault();
				this.fire('dragleave');
			}, this);
			target['ondragover'] = _bind(function (e) {
				e.preventDefault();
				if (!this.disabled) {
					this.fire('dragover');
				}
			}, this);
			target['ondrop'] = _bind(function (e) {
				e.preventDefault();
				if (!this.disabled) {
					var files = e.dataTransfer.files;
					this.fire('drop', files);
					if (files.length) {
						this.uploadFiles(files);
					}
				}
			}, this);
		}

		if (DRAGANDDROP_SUPPORT) {
			if (FILEAPI_SUPPORT) {
				var input_el = this.input_el;
				input_el['ondragenter'] = input_el['ondragover'] = input_el['ondragleave'] = input_el['ondrop'] = function (e) {
					e.preventDefault();
				};
			}
			if (target) {
				target['ondragenter'] = target['ondragover'] = target['ondragleave'] = target.ondrop = function (e) {
					e.preventDefault();
				};
			}
		}
	};

	/**
	 * Removes event listeners/handlers from DOM elements
	 */
	OfflineUploader.prototype.removeListeners = function () {
		if (IE) {
			this.button_el.onclick = null;
		} else {
			this.input_el.onchange = null;
		}

		if (DRAGANDDROP_SUPPORT && this.params['drop']) {
			this.params['drop']['ondragenter'] = null;
			this.params['drop']['ondragover'] = null;
			this.params['drop']['ondragleave'] = null;
			this.params['drop']['ondrop'] = null;
			this.input_el['ondragenter'] = null;
			this.input_el['ondragover'] = null;
			this.input_el['ondragleave'] = null;
			this.input_el['ondrop'] = null;
		}
	};

	/**
	 * Updates the component state on a classic upload
	 */
	OfflineUploader.prototype.beginUploading = function () {
		this['disable']();
		this.label('Uploading...');

		var e = this.input_el.value.match(/(\\|\/)([^\\|\/]+)$/);
		var name = e ? e[2] : this.input_el.value;

		this.iframe_el.onload = _bind(function () {
			var body = this.iframe_el.contentWindow.document.body;
			var data = body.textContent || body.innerHTML || null;
			this.confirm(data);
		}, this);

		this.fire('uploading', name);
	};


	/**
	 * @constructor
	 * @implements {IOnlineUploader}
	 * @param {Object=} params Various parameters
	 */
	var OnlineUploader = function (params) {
		this.params = params || {};
	};

	OnlineUploader.prototype['uploadBase64'] = function (name, data, callback) {
		var body = [
			'name=' + encodeURIComponent(name),
			'data=' + encodeURIComponent(data)
		].join('&');

		var xhr = new XMLHttpRequest();
		xhr.open('POST', this.params.api, true);
		xhr.setRequestHeader('x-requested-with', 'XMLHttpRequest');
		xhr.setRequestHeader('content-type',
			'application/x-www-form-urlencoded; charset=UTF-8');
		xhr.onreadystatechange = _bind(function () {
			if (xhr.readyState === 4) {
				if (xhr.status < 300) {
					if (typeof callback === 'function') {
						callback(null);
					}
				} else {
					if (typeof callback === 'function') {
						callback(new Error('Failed to upload the item. Auto-retrying in a moment.'));
					}
					setTimeout(_bind(function () {
						this['uploadBase64'](name, data, callback);
					}, this), 5000);
				}
			}
		}, this);
		xhr.send(body);
	};


	/**
	 * @constructor
	 * @extends {OnlineUploader}
	 * @implements {IOfflineStorage}
	 */
	var IndexedDBStorage = function (params) {
		this.idle = false;

		this.params = params;
	};

	IndexedDBStorage.DB_VERSION = '1.0';

	IndexedDBStorage.prototype = new OnlineUploader();
	IndexedDBStorage.prototype.constructor = IndexedDBStorage;

	IndexedDBStorage.prototype.db = null;
	
	/**
	 * Estabilishes a connection to an IndexedDB storage
	 *
	 * @param {function(Error)=} callback A callback function
	 */
	IndexedDBStorage.prototype.connect = function (callback) {
		var DB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB;
		var req = DB.open(this.params['ns'], '');
		req.onsuccess = _bind(function (e) {
			this.db = e.target.result;
			this.build(_bind(function () {
				this.idle = true;
				this.pushQueue();
				if (typeof callback === 'function') {
					callback(null);
				}
			}, this));
		}, this);
		req.onfailure = _bind(function (e) {
			this.disconnect();
			if (typeof callback === 'function') {
				callback(new Error('Database connection failed'));
			}
		}, this);
	};

	/**
	 * Closes the connection to the IndexedDB storage
	 */
	IndexedDBStorage.prototype.disconnect = function () {
		if (this.db) {
			this.db.close();
		}
		this.db = null;
	};

	/**
	 * Stores a file in the IndexedDB storage
	 *
	 * @param {!File} file A file
	 * @param {string} data Base64-encoded contents
	 * @param {function(Error)=} callback A callback function
	 */
	IndexedDBStorage.prototype['store'] = function (file, data, callback) {
		var tx = this.createTransaction(true);
		var req = tx.objectStore(this.params['store']).add({
			name: file.name,
			data: data
		});
		if (typeof callback === 'function') {
			req.onsuccess = function () {
				callback(null);
				if (this.idle) {
					this.pushQueue();
				}
			};
			req.onfailure = function () {
				callback(new Error('Failed to store the item'));
			};
		}
	};

	/**
	 * Tries to push the oldest stored file to the server
	 *
	 * @param {function()=} callback A callback function
	 */
	IndexedDBStorage.prototype.pushQueue = function (callback) {
		var tx = this.createTransaction(false);
		var IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange;
		var range = /*(IDBKeyRange.lowerBound ||*/ IDBKeyRange.leftBound(0);

		this.idle = true;

		var req = tx.objectStore(this.params['store']).openCursor(range);
		req.onsuccess = _bind(function (e) {
			var result = e.target.result;
			if (result) {
				var value = result.value;
				this['uploadBase64'](value.name, value.data, _bind(function () {
					var tx = this.createTransaction(true);
					var store = tx.objectStore(this.params['store']);

					var req = store['delete'](result.key);
					req.onsuccess = _bind(function () {
						this.pushQueue(callback);
					}, this);
				}, this));
			} else {
				this.idle = true;
				if (typeof callback === 'function') {
					callback();
				}
			}
		}, this);
		req.onfailure = _bind(function () {
			this.idle = true;
		}, this);
	};

	/**
	 * Builds the IndexedDB structure if needed
	 *
	 * @param {function(Error)=} callback A callback function
	 */
	IndexedDBStorage.prototype.build = function (callback) {
		if (this.db.version === IndexedDBStorage.DB_VERSION) {
			if (typeof callback === 'function') {
				callback(null);
			}
			return;
		}

		var req = this.db.setVersion(IndexedDBStorage.DB_VERSION);
		req.onsuccess = _bind(function (e) {
			this.db.createObjectStore(this.params['store'], {
				autoIncrement: true
			});
			if (typeof callback === 'function') {
				callback(null);
			}
		}, this);
		req.onfailure = _bind(function () {
			this.disconnect();
			callback(new Error('Database build failed'));
		}, this);
	};

	/**
	 * Creates an IndexedDB transaction object
	 *
	 * @param {boolean} write Allow writing?
	 * @return {IDBTransaction} A transaction object
	 */
	IndexedDBStorage.prototype.createTransaction = function (write) {
		var IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction;
		return this.db.transaction(
			[this.params['store']],
			write ? IDBTransaction.READ_WRITE : IDBTransaction.READ_ONLY,
			0
		);
	};


	/**
	 * @constructor
	 * @extends {OnlineUploader}
	 * @implements {IOfflineStorage}
	 */
	var WebSQLStorage = function (params) {
		this.params = params;
	};

	WebSQLStorage.DB_VERSION = '1.0';

	WebSQLStorage.prototype = new OnlineUploader();
	WebSQLStorage.prototype.constructor = function () {
		OnlineUploader.apply(this, __slice.call(arguments));
		WebSQLStorage.apply(this, __slice.call(arguments));
	};

	WebSQLStorage.prototype.db = null;

	/**
	 * Estabilishes a connection to an Web SQL storage
	 *
	 * @param {function(Error)=} callback A callback function
	 */
	WebSQLStorage.prototype.connect = function (callback) {
		this.db = window.openDatabase(this.params['ns'], WebSQLStorage.DB_VERSION,
			'', 10 * 1024 * 1024/*, _bind(function (db) {
				this.build(db, callback);
			}, this)*/
		);
		if (!this.db) {
			this.disconnect();
			callback(new Error('Database connection failed'));
		} else if (this.db.version === WebSQLStorage.DB_VERSION) {
			callback(null);
		}
	};

	/**
	 * Closes the connection to the IndexedDB storage
	 */
	WebSQLStorage.prototype.disconnect = function () {
		this.db = null;
	};

	/**
	 * Builds the Web SQL database structure when needed
	 *
	 * @param {function(Error)=} callback A callback function
	 */
	WebSQLStorage.prototype.build = function (db, callback) {
		db.changeVersion(db.version, WebSQLStorage.DB_VERSION, _bind(function (tx) {
			tx.executeSql("CREATE TABLE [?] ( " +
				"[id] INTEGER PRIMARY KEY AUTOINCREMENT, " +
				"[name], [data] " +
			")", [this.params['store']], function () {
				if (typeof callback === 'function') {
					callback(null);
				}
			}, _bind(function () {
				this.disconnect();
				callback(new Error('Database build failed'));
			}, this));
		}, this));
	};

	/**
	 * Stores a file in the IndexedDB storage
	 *
	 * @param {!File} file A file
	 * @param {string} data Base64-encoded contents
	 * @param {function(Error)=} callback A callback function
	 */
	WebSQLStorage.prototype['store'] = function (file, data, callback) {
		this.db.transaction(_bind(function (tx) {
			var onsuccess = function () {
				if (typeof callback === 'function') {
					callback(null);
				}
			};
			var onfailure = function () {
				if (typeof callback === 'function') {
					callback(new Error('Failed to store the item'));
				}
			};
			tx.executeSql("INSERT INTO [?] ([name], [data]) VALUES (?, ?)",
				[this.params['store'], file.name, data], onsuccess, onfailure
			);
		}, this));
	};

	/**
	 * Tries to push the oldest stored file to the server
	 *
	 * @param {function()=} callback A callback function
	 */
	WebSQLStorage.prototype.pushQueue = function (callback) {
		var store = this.params['store'];

		var onreadsuccess = _bind(function (tx, res) {
			var value = res.rows[0];
			if (value) {
				this['uploadBase64'](value, function () {
					tx.executeSql("DELETE FROM [?] WHERE [id] = ?",
						[store, value.id], ondeletesuccess
					);
				});
			} else {
				if (typeof callback === 'function') {
					callback();
				}
			}
		}, this);
		var ondeletesuccess = _bind(function () {
			this.pushQueue(callback);
		}, this);

		this.db.transaction(function (tx) {
			tx.executeSql("SELECT * FROM [?] LIMIT 1", [store], onreadsuccess);
		});
	};


	global['OfflineUploader'] = OfflineUploader;

}(window));

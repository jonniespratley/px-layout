/**
 ResourceTree generation from array of documents
*/
'use strict';

function extend(a, b) {
	for (var key in b) {
		a[key] = b[key];
	}

	return a;
}

function Doc(obj) {
	var o = obj;

	if (typeof obj.parent === 'string') {
		obj.parent_id = obj.parent;
	} else if (obj.parent && obj.parent.length) {
		obj.parent_id = obj.parent[0];
	}
	var newObj = extend({
		_id: obj._id || 'resource-' + Date.now(),
		id: obj._id,
		text: obj.displayName || obj._id,
		category: 'General',
		dataType: 'entity',
		displayName: 'Doc 1',
		displayType: '',
		data: null,
		channels: o.channels,
		parent: null,
		children: obj.children || []
	}, obj);

	//delete newObj.id;
	if (newObj.parent_id === '0') {
		newObj.parent = '';
	}
	if (!newObj.hasOwnProperty('type')) {
		newObj['type'] = 'node';
	}

	if (newObj.children && newObj.children.length > 1) {

	}
	return newObj;
}

/**
 * I create a resource tree from the results of Couchbase _all_docs query.
 */
function ResourceTree(data) {
	var self = this;
	this.rootNodes = [];
	this.nodesMap = {};
	self.rows = [];

	if (data && data.rows) {
		data.rows.forEach(function (row) {
			if (row && row.dataType === 'entity') {
				self.rows.push(new Doc(row));
			}
		});
	}

	self.rows.forEach(function (row) {
		console.warn('Indexing', row);
		self.nodesMap[row._id] = row;
	});

	self.rootNodes = self.rows.filter(function (row) {
		if (row.parent && row.parent.length === 0) {
			console.warn('Found root node', row);
			return true;
		} else if (row.parent === null) {
			return true;
		} else if (!self.nodesMap[row.parent_id]) {
			return true;
		} else {
			return false;
		}
	});

	self.rows.forEach(function (row) {
		if (self.nodesMap[row.parent_id]) {
			row.hasChildren = true;
			row.meta = {
				parentId: row.parent_id
			};
			self.nodesMap[row.parent_id].children.push(row);
		}
	});

	var nodesWithParent = self.rows.filter(function (row) {
		if (row.parent && row.parent.length > 0) {
			return true;
		} else {
			return false;
		}
	});

	this.getRootNodes = function () {
		return self.rootNodes;
	};

	this.findById = function (id) {
		if (self.nodesMap.hasOwnProperty(id)) {
			return self.nodesMap[id];
		} else {
			return false;
		}
	};

	this.hasChildren = function (id) {
		if (self.findById(id) && self.findById(id).children.length > 0) {
			return true;
		} else {
			return false;
		}
	};

	this.getNode = function (id) {
		return this.findById(id);
	};

	this.getChildren = function (id) {
		if (this.hasChildren(id)) {
			return this.findById(id).children;
		} else {
			return false;
		}
	};

	console.log('ResourceTree', this);
	return this;
}



function loadDemoData(url) {
	return new Promise(function (resolve, reject) {
		fetch(url).then(function (resp) {
			resp.json().then(function (json) {
				resolve(json);
			});
		}).catch(reject);
	});
}

function createResourceTree(data) {
	return new Promise(function (resolve, reject) {
		try {
			var _tree = new ResourceTree(data);
		} catch (e) {
			reject(e);
		} finally {
			resolve(_tree);
		}
	});
}


/**


loadDemoData('data.json')
	.then(function(data) {
		return createResourceTree({
			rows: data
		});
	})
	.then(function(tree) {
		console.log(tree);
	});
*/

window.hideUrlBar = function () {
	var win = window,
		doc = win.document;
	// If there's a hash, or addEventListener is undefined, stop here
	if (!location.hash || !win.addEventListener) {
		//scroll to 1
		window.scrollTo(0, 1);
		var scrollTop = 1,
			//reset to 0 on bodyready, if needed
			bodycheck = setInterval(function () {
				if (doc.body) {
					clearInterval(bodycheck);
					scrollTop = "scrollTop" in doc.body ? doc.body.scrollTop : 1;
					win.scrollTo(0, scrollTop === 1 ? 0 : 1);
				}
			}, 15);
		win.addEventListener("load", function () {
			setTimeout(function () {
				//reset to hide addr bar at onload
				win.scrollTo(0, scrollTop === 1 ? 0 : 1);
			}, 0);
		}, false);
	}
};

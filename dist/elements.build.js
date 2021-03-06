(function () {
function resolve() {
document.body.removeAttribute('unresolved');
}
if (window.WebComponents) {
addEventListener('WebComponentsReady', resolve);
} else {
if (document.readyState === 'interactive' || document.readyState === 'complete') {
resolve();
} else {
addEventListener('DOMContentLoaded', resolve);
}
}
}());
window.Polymer = {
Settings: function () {
var settings = window.Polymer || {};
var parts = location.search.slice(1).split('&');
for (var i = 0, o; i < parts.length && (o = parts[i]); i++) {
o = o.split('=');
o[0] && (settings[o[0]] = o[1] || true);
}
settings.wantShadow = settings.dom === 'shadow';
settings.hasShadow = Boolean(Element.prototype.createShadowRoot);
settings.nativeShadow = settings.hasShadow && !window.ShadowDOMPolyfill;
settings.useShadow = settings.wantShadow && settings.hasShadow;
settings.hasNativeImports = Boolean('import' in document.createElement('link'));
settings.useNativeImports = settings.hasNativeImports;
settings.useNativeCustomElements = !window.CustomElements || window.CustomElements.useNative;
settings.useNativeShadow = settings.useShadow && settings.nativeShadow;
settings.usePolyfillProto = !settings.useNativeCustomElements && !Object.__proto__;
return settings;
}()
};
(function () {
var userPolymer = window.Polymer;
window.Polymer = function (prototype) {
if (typeof prototype === 'function') {
prototype = prototype.prototype;
}
if (!prototype) {
prototype = {};
}
var factory = desugar(prototype);
prototype = factory.prototype;
var options = { prototype: prototype };
if (prototype.extends) {
options.extends = prototype.extends;
}
Polymer.telemetry._registrate(prototype);
document.registerElement(prototype.is, options);
return factory;
};
var desugar = function (prototype) {
var base = Polymer.Base;
if (prototype.extends) {
base = Polymer.Base._getExtendedPrototype(prototype.extends);
}
prototype = Polymer.Base.chainObject(prototype, base);
prototype.registerCallback();
return prototype.constructor;
};
if (userPolymer) {
for (var i in userPolymer) {
Polymer[i] = userPolymer[i];
}
}
Polymer.Class = desugar;
}());
Polymer.telemetry = {
registrations: [],
_regLog: function (prototype) {
console.log('[' + prototype.is + ']: registered');
},
_registrate: function (prototype) {
this.registrations.push(prototype);
Polymer.log && this._regLog(prototype);
},
dumpRegistrations: function () {
this.registrations.forEach(this._regLog);
}
};
Object.defineProperty(window, 'currentImport', {
enumerable: true,
configurable: true,
get: function () {
return (document._currentScript || document.currentScript).ownerDocument;
}
});
Polymer.RenderStatus = {
_ready: false,
_callbacks: [],
whenReady: function (cb) {
if (this._ready) {
cb();
} else {
this._callbacks.push(cb);
}
},
_makeReady: function () {
this._ready = true;
for (var i = 0; i < this._callbacks.length; i++) {
this._callbacks[i]();
}
this._callbacks = [];
},
_catchFirstRender: function () {
requestAnimationFrame(function () {
Polymer.RenderStatus._makeReady();
});
},
_afterNextRenderQueue: [],
_waitingNextRender: false,
afterNextRender: function (element, fn, args) {
this._watchNextRender();
this._afterNextRenderQueue.push([
element,
fn,
args
]);
},
_watchNextRender: function () {
if (!this._waitingNextRender) {
this._waitingNextRender = true;
var fn = function () {
Polymer.RenderStatus._flushNextRender();
};
if (!this._ready) {
this.whenReady(fn);
} else {
requestAnimationFrame(fn);
}
}
},
_flushNextRender: function () {
var self = this;
setTimeout(function () {
self._flushRenderCallbacks(self._afterNextRenderQueue);
self._afterNextRenderQueue = [];
self._waitingNextRender = false;
});
},
_flushRenderCallbacks: function (callbacks) {
for (var i = 0, h; i < callbacks.length; i++) {
h = callbacks[i];
h[1].apply(h[0], h[2] || Polymer.nar);
}
}
};
if (window.HTMLImports) {
HTMLImports.whenReady(function () {
Polymer.RenderStatus._catchFirstRender();
});
} else {
Polymer.RenderStatus._catchFirstRender();
}
Polymer.ImportStatus = Polymer.RenderStatus;
Polymer.ImportStatus.whenLoaded = Polymer.ImportStatus.whenReady;
(function () {
'use strict';
var settings = Polymer.Settings;
Polymer.Base = {
__isPolymerInstance__: true,
_addFeature: function (feature) {
this.extend(this, feature);
},
registerCallback: function () {
this._desugarBehaviors();
this._doBehavior('beforeRegister');
this._registerFeatures();
if (!settings.lazyRegister) {
this.ensureRegisterFinished();
}
},
createdCallback: function () {
if (!this.__hasRegisterFinished) {
this._ensureRegisterFinished(this.__proto__);
}
Polymer.telemetry.instanceCount++;
this.root = this;
this._doBehavior('created');
this._initFeatures();
},
ensureRegisterFinished: function () {
this._ensureRegisterFinished(this);
},
_ensureRegisterFinished: function (proto) {
if (proto.__hasRegisterFinished !== proto.is) {
proto.__hasRegisterFinished = proto.is;
if (proto._finishRegisterFeatures) {
proto._finishRegisterFeatures();
}
proto._doBehavior('registered');
if (settings.usePolyfillProto && proto !== this) {
proto.extend(this, proto);
}
}
},
attachedCallback: function () {
var self = this;
Polymer.RenderStatus.whenReady(function () {
self.isAttached = true;
self._doBehavior('attached');
});
},
detachedCallback: function () {
var self = this;
Polymer.RenderStatus.whenReady(function () {
self.isAttached = false;
self._doBehavior('detached');
});
},
attributeChangedCallback: function (name, oldValue, newValue) {
this._attributeChangedImpl(name);
this._doBehavior('attributeChanged', [
name,
oldValue,
newValue
]);
},
_attributeChangedImpl: function (name) {
this._setAttributeToProperty(this, name);
},
extend: function (prototype, api) {
if (prototype && api) {
var n$ = Object.getOwnPropertyNames(api);
for (var i = 0, n; i < n$.length && (n = n$[i]); i++) {
this.copyOwnProperty(n, api, prototype);
}
}
return prototype || api;
},
mixin: function (target, source) {
for (var i in source) {
target[i] = source[i];
}
return target;
},
copyOwnProperty: function (name, source, target) {
var pd = Object.getOwnPropertyDescriptor(source, name);
if (pd) {
Object.defineProperty(target, name, pd);
}
},
_logger: function (level, args) {
if (args.length === 1 && Array.isArray(args[0])) {
args = args[0];
}
switch (level) {
case 'log':
case 'warn':
case 'error':
console[level].apply(console, args);
break;
}
},
_log: function () {
var args = Array.prototype.slice.call(arguments, 0);
this._logger('log', args);
},
_warn: function () {
var args = Array.prototype.slice.call(arguments, 0);
this._logger('warn', args);
},
_error: function () {
var args = Array.prototype.slice.call(arguments, 0);
this._logger('error', args);
},
_logf: function () {
return this._logPrefix.concat(this.is).concat(Array.prototype.slice.call(arguments, 0));
}
};
Polymer.Base._logPrefix = function () {
var color = window.chrome && !/edge/i.test(navigator.userAgent) || /firefox/i.test(navigator.userAgent);
return color ? [
'%c[%s::%s]:',
'font-weight: bold; background-color:#EEEE00;'
] : ['[%s::%s]:'];
}();
Polymer.Base.chainObject = function (object, inherited) {
if (object && inherited && object !== inherited) {
if (!Object.__proto__) {
object = Polymer.Base.extend(Object.create(inherited), object);
}
object.__proto__ = inherited;
}
return object;
};
Polymer.Base = Polymer.Base.chainObject(Polymer.Base, HTMLElement.prototype);
if (window.CustomElements) {
Polymer.instanceof = CustomElements.instanceof;
} else {
Polymer.instanceof = function (obj, ctor) {
return obj instanceof ctor;
};
}
Polymer.isInstance = function (obj) {
return Boolean(obj && obj.__isPolymerInstance__);
};
Polymer.telemetry.instanceCount = 0;
}());
(function () {
var modules = {};
var lcModules = {};
var findModule = function (id) {
return modules[id] || lcModules[id.toLowerCase()];
};
var DomModule = function () {
return document.createElement('dom-module');
};
DomModule.prototype = Object.create(HTMLElement.prototype);
Polymer.Base.extend(DomModule.prototype, {
constructor: DomModule,
createdCallback: function () {
this.register();
},
register: function (id) {
id = id || this.id || this.getAttribute('name') || this.getAttribute('is');
if (id) {
this.id = id;
modules[id] = this;
lcModules[id.toLowerCase()] = this;
}
},
import: function (id, selector) {
if (id) {
var m = findModule(id);
if (!m) {
forceDomModulesUpgrade();
m = findModule(id);
}
if (m && selector) {
m = m.querySelector(selector);
}
return m;
}
}
});
var cePolyfill = window.CustomElements && !CustomElements.useNative;
document.registerElement('dom-module', DomModule);
function forceDomModulesUpgrade() {
if (cePolyfill) {
var script = document._currentScript || document.currentScript;
var doc = script && script.ownerDocument || document;
var modules = doc.querySelectorAll('dom-module');
for (var i = modules.length - 1, m; i >= 0 && (m = modules[i]); i--) {
if (m.__upgraded__) {
return;
} else {
CustomElements.upgrade(m);
}
}
}
}
}());
Polymer.Base._addFeature({
_prepIs: function () {
if (!this.is) {
var module = (document._currentScript || document.currentScript).parentNode;
if (module.localName === 'dom-module') {
var id = module.id || module.getAttribute('name') || module.getAttribute('is');
this.is = id;
}
}
if (this.is) {
this.is = this.is.toLowerCase();
}
}
});
Polymer.Base._addFeature({
behaviors: [],
_desugarBehaviors: function () {
if (this.behaviors.length) {
this.behaviors = this._desugarSomeBehaviors(this.behaviors);
}
},
_desugarSomeBehaviors: function (behaviors) {
var behaviorSet = [];
behaviors = this._flattenBehaviorsList(behaviors);
for (var i = behaviors.length - 1; i >= 0; i--) {
var b = behaviors[i];
if (behaviorSet.indexOf(b) === -1) {
this._mixinBehavior(b);
behaviorSet.unshift(b);
}
}
return behaviorSet;
},
_flattenBehaviorsList: function (behaviors) {
var flat = [];
for (var i = 0; i < behaviors.length; i++) {
var b = behaviors[i];
if (b instanceof Array) {
flat = flat.concat(this._flattenBehaviorsList(b));
} else if (b) {
flat.push(b);
} else {
this._warn(this._logf('_flattenBehaviorsList', 'behavior is null, check for missing or 404 import'));
}
}
return flat;
},
_mixinBehavior: function (b) {
var n$ = Object.getOwnPropertyNames(b);
for (var i = 0, n; i < n$.length && (n = n$[i]); i++) {
if (!Polymer.Base._behaviorProperties[n] && !this.hasOwnProperty(n)) {
this.copyOwnProperty(n, b, this);
}
}
},
_prepBehaviors: function () {
this._prepFlattenedBehaviors(this.behaviors);
},
_prepFlattenedBehaviors: function (behaviors) {
for (var i = 0, l = behaviors.length; i < l; i++) {
this._prepBehavior(behaviors[i]);
}
this._prepBehavior(this);
},
_doBehavior: function (name, args) {
for (var i = 0; i < this.behaviors.length; i++) {
this._invokeBehavior(this.behaviors[i], name, args);
}
this._invokeBehavior(this, name, args);
},
_invokeBehavior: function (b, name, args) {
var fn = b[name];
if (fn) {
fn.apply(this, args || Polymer.nar);
}
},
_marshalBehaviors: function () {
for (var i = 0; i < this.behaviors.length; i++) {
this._marshalBehavior(this.behaviors[i]);
}
this._marshalBehavior(this);
}
});
Polymer.Base._behaviorProperties = {
hostAttributes: true,
beforeRegister: true,
registered: true,
properties: true,
observers: true,
listeners: true,
created: true,
attached: true,
detached: true,
attributeChanged: true,
ready: true
};
Polymer.Base._addFeature({
_getExtendedPrototype: function (tag) {
return this._getExtendedNativePrototype(tag);
},
_nativePrototypes: {},
_getExtendedNativePrototype: function (tag) {
var p = this._nativePrototypes[tag];
if (!p) {
var np = this.getNativePrototype(tag);
p = this.extend(Object.create(np), Polymer.Base);
this._nativePrototypes[tag] = p;
}
return p;
},
getNativePrototype: function (tag) {
return Object.getPrototypeOf(document.createElement(tag));
}
});
Polymer.Base._addFeature({
_prepConstructor: function () {
this._factoryArgs = this.extends ? [
this.extends,
this.is
] : [this.is];
var ctor = function () {
return this._factory(arguments);
};
if (this.hasOwnProperty('extends')) {
ctor.extends = this.extends;
}
Object.defineProperty(this, 'constructor', {
value: ctor,
writable: true,
configurable: true
});
ctor.prototype = this;
},
_factory: function (args) {
var elt = document.createElement.apply(document, this._factoryArgs);
if (this.factoryImpl) {
this.factoryImpl.apply(elt, args);
}
return elt;
}
});
Polymer.nob = Object.create(null);
Polymer.Base._addFeature({
properties: {},
getPropertyInfo: function (property) {
var info = this._getPropertyInfo(property, this.properties);
if (!info) {
for (var i = 0; i < this.behaviors.length; i++) {
info = this._getPropertyInfo(property, this.behaviors[i].properties);
if (info) {
return info;
}
}
}
return info || Polymer.nob;
},
_getPropertyInfo: function (property, properties) {
var p = properties && properties[property];
if (typeof p === 'function') {
p = properties[property] = { type: p };
}
if (p) {
p.defined = true;
}
return p;
},
_prepPropertyInfo: function () {
this._propertyInfo = {};
for (var i = 0; i < this.behaviors.length; i++) {
this._addPropertyInfo(this._propertyInfo, this.behaviors[i].properties);
}
this._addPropertyInfo(this._propertyInfo, this.properties);
this._addPropertyInfo(this._propertyInfo, this._propertyEffects);
},
_addPropertyInfo: function (target, source) {
if (source) {
var t, s;
for (var i in source) {
t = target[i];
s = source[i];
if (i[0] === '_' && !s.readOnly) {
continue;
}
if (!target[i]) {
target[i] = {
type: typeof s === 'function' ? s : s.type,
readOnly: s.readOnly,
attribute: Polymer.CaseMap.camelToDashCase(i)
};
} else {
if (!t.type) {
t.type = s.type;
}
if (!t.readOnly) {
t.readOnly = s.readOnly;
}
}
}
}
}
});
Polymer.CaseMap = {
_caseMap: {},
_rx: {
dashToCamel: /-[a-z]/g,
camelToDash: /([A-Z])/g
},
dashToCamelCase: function (dash) {
return this._caseMap[dash] || (this._caseMap[dash] = dash.indexOf('-') < 0 ? dash : dash.replace(this._rx.dashToCamel, function (m) {
return m[1].toUpperCase();
}));
},
camelToDashCase: function (camel) {
return this._caseMap[camel] || (this._caseMap[camel] = camel.replace(this._rx.camelToDash, '-$1').toLowerCase());
}
};
Polymer.Base._addFeature({
_addHostAttributes: function (attributes) {
if (!this._aggregatedAttributes) {
this._aggregatedAttributes = {};
}
if (attributes) {
this.mixin(this._aggregatedAttributes, attributes);
}
},
_marshalHostAttributes: function () {
if (this._aggregatedAttributes) {
this._applyAttributes(this, this._aggregatedAttributes);
}
},
_applyAttributes: function (node, attr$) {
for (var n in attr$) {
if (!this.hasAttribute(n) && n !== 'class') {
var v = attr$[n];
this.serializeValueToAttribute(v, n, this);
}
}
},
_marshalAttributes: function () {
this._takeAttributesToModel(this);
},
_takeAttributesToModel: function (model) {
if (this.hasAttributes()) {
for (var i in this._propertyInfo) {
var info = this._propertyInfo[i];
if (this.hasAttribute(info.attribute)) {
this._setAttributeToProperty(model, info.attribute, i, info);
}
}
}
},
_setAttributeToProperty: function (model, attribute, property, info) {
if (!this._serializing) {
property = property || Polymer.CaseMap.dashToCamelCase(attribute);
info = info || this._propertyInfo && this._propertyInfo[property];
if (info && !info.readOnly) {
var v = this.getAttribute(attribute);
model[property] = this.deserialize(v, info.type);
}
}
},
_serializing: false,
reflectPropertyToAttribute: function (property, attribute, value) {
this._serializing = true;
value = value === undefined ? this[property] : value;
this.serializeValueToAttribute(value, attribute || Polymer.CaseMap.camelToDashCase(property));
this._serializing = false;
},
serializeValueToAttribute: function (value, attribute, node) {
var str = this.serialize(value);
node = node || this;
if (str === undefined) {
node.removeAttribute(attribute);
} else {
node.setAttribute(attribute, str);
}
},
deserialize: function (value, type) {
switch (type) {
case Number:
value = Number(value);
break;
case Boolean:
value = value != null;
break;
case Object:
try {
value = JSON.parse(value);
} catch (x) {
}
break;
case Array:
try {
value = JSON.parse(value);
} catch (x) {
value = null;
console.warn('Polymer::Attributes: couldn`t decode Array as JSON');
}
break;
case Date:
value = new Date(value);
break;
case String:
default:
break;
}
return value;
},
serialize: function (value) {
switch (typeof value) {
case 'boolean':
return value ? '' : undefined;
case 'object':
if (value instanceof Date) {
return value.toString();
} else if (value) {
try {
return JSON.stringify(value);
} catch (x) {
return '';
}
}
default:
return value != null ? value : undefined;
}
}
});
Polymer.version = '1.5.0';
Polymer.Base._addFeature({
_registerFeatures: function () {
this._prepIs();
this._prepBehaviors();
this._prepConstructor();
this._prepPropertyInfo();
},
_prepBehavior: function (b) {
this._addHostAttributes(b.hostAttributes);
},
_marshalBehavior: function (b) {
},
_initFeatures: function () {
this._marshalHostAttributes();
this._marshalBehaviors();
}
});
Polymer.Base._addFeature({
_prepTemplate: function () {
if (this._template === undefined) {
this._template = Polymer.DomModule.import(this.is, 'template');
}
if (this._template && this._template.hasAttribute('is')) {
this._warn(this._logf('_prepTemplate', 'top-level Polymer template ' + 'must not be a type-extension, found', this._template, 'Move inside simple <template>.'));
}
if (this._template && !this._template.content && window.HTMLTemplateElement && HTMLTemplateElement.decorate) {
HTMLTemplateElement.decorate(this._template);
}
},
_stampTemplate: function () {
if (this._template) {
this.root = this.instanceTemplate(this._template);
}
},
instanceTemplate: function (template) {
var dom = document.importNode(template._content || template.content, true);
return dom;
}
});
(function () {
var baseAttachedCallback = Polymer.Base.attachedCallback;
Polymer.Base._addFeature({
_hostStack: [],
ready: function () {
},
_registerHost: function (host) {
this.dataHost = host = host || Polymer.Base._hostStack[Polymer.Base._hostStack.length - 1];
if (host && host._clients) {
host._clients.push(this);
}
this._clients = null;
this._clientsReadied = false;
},
_beginHosting: function () {
Polymer.Base._hostStack.push(this);
if (!this._clients) {
this._clients = [];
}
},
_endHosting: function () {
Polymer.Base._hostStack.pop();
},
_tryReady: function () {
this._readied = false;
if (this._canReady()) {
this._ready();
}
},
_canReady: function () {
return !this.dataHost || this.dataHost._clientsReadied;
},
_ready: function () {
this._beforeClientsReady();
if (this._template) {
this._setupRoot();
this._readyClients();
}
this._clientsReadied = true;
this._clients = null;
this._afterClientsReady();
this._readySelf();
},
_readyClients: function () {
this._beginDistribute();
var c$ = this._clients;
if (c$) {
for (var i = 0, l = c$.length, c; i < l && (c = c$[i]); i++) {
c._ready();
}
}
this._finishDistribute();
},
_readySelf: function () {
this._doBehavior('ready');
this._readied = true;
if (this._attachedPending) {
this._attachedPending = false;
this.attachedCallback();
}
},
_beforeClientsReady: function () {
},
_afterClientsReady: function () {
},
_beforeAttached: function () {
},
attachedCallback: function () {
if (this._readied) {
this._beforeAttached();
baseAttachedCallback.call(this);
} else {
this._attachedPending = true;
}
}
});
}());
Polymer.ArraySplice = function () {
function newSplice(index, removed, addedCount) {
return {
index: index,
removed: removed,
addedCount: addedCount
};
}
var EDIT_LEAVE = 0;
var EDIT_UPDATE = 1;
var EDIT_ADD = 2;
var EDIT_DELETE = 3;
function ArraySplice() {
}
ArraySplice.prototype = {
calcEditDistances: function (current, currentStart, currentEnd, old, oldStart, oldEnd) {
var rowCount = oldEnd - oldStart + 1;
var columnCount = currentEnd - currentStart + 1;
var distances = new Array(rowCount);
for (var i = 0; i < rowCount; i++) {
distances[i] = new Array(columnCount);
distances[i][0] = i;
}
for (var j = 0; j < columnCount; j++)
distances[0][j] = j;
for (i = 1; i < rowCount; i++) {
for (j = 1; j < columnCount; j++) {
if (this.equals(current[currentStart + j - 1], old[oldStart + i - 1]))
distances[i][j] = distances[i - 1][j - 1];
else {
var north = distances[i - 1][j] + 1;
var west = distances[i][j - 1] + 1;
distances[i][j] = north < west ? north : west;
}
}
}
return distances;
},
spliceOperationsFromEditDistances: function (distances) {
var i = distances.length - 1;
var j = distances[0].length - 1;
var current = distances[i][j];
var edits = [];
while (i > 0 || j > 0) {
if (i == 0) {
edits.push(EDIT_ADD);
j--;
continue;
}
if (j == 0) {
edits.push(EDIT_DELETE);
i--;
continue;
}
var northWest = distances[i - 1][j - 1];
var west = distances[i - 1][j];
var north = distances[i][j - 1];
var min;
if (west < north)
min = west < northWest ? west : northWest;
else
min = north < northWest ? north : northWest;
if (min == northWest) {
if (northWest == current) {
edits.push(EDIT_LEAVE);
} else {
edits.push(EDIT_UPDATE);
current = northWest;
}
i--;
j--;
} else if (min == west) {
edits.push(EDIT_DELETE);
i--;
current = west;
} else {
edits.push(EDIT_ADD);
j--;
current = north;
}
}
edits.reverse();
return edits;
},
calcSplices: function (current, currentStart, currentEnd, old, oldStart, oldEnd) {
var prefixCount = 0;
var suffixCount = 0;
var minLength = Math.min(currentEnd - currentStart, oldEnd - oldStart);
if (currentStart == 0 && oldStart == 0)
prefixCount = this.sharedPrefix(current, old, minLength);
if (currentEnd == current.length && oldEnd == old.length)
suffixCount = this.sharedSuffix(current, old, minLength - prefixCount);
currentStart += prefixCount;
oldStart += prefixCount;
currentEnd -= suffixCount;
oldEnd -= suffixCount;
if (currentEnd - currentStart == 0 && oldEnd - oldStart == 0)
return [];
if (currentStart == currentEnd) {
var splice = newSplice(currentStart, [], 0);
while (oldStart < oldEnd)
splice.removed.push(old[oldStart++]);
return [splice];
} else if (oldStart == oldEnd)
return [newSplice(currentStart, [], currentEnd - currentStart)];
var ops = this.spliceOperationsFromEditDistances(this.calcEditDistances(current, currentStart, currentEnd, old, oldStart, oldEnd));
splice = undefined;
var splices = [];
var index = currentStart;
var oldIndex = oldStart;
for (var i = 0; i < ops.length; i++) {
switch (ops[i]) {
case EDIT_LEAVE:
if (splice) {
splices.push(splice);
splice = undefined;
}
index++;
oldIndex++;
break;
case EDIT_UPDATE:
if (!splice)
splice = newSplice(index, [], 0);
splice.addedCount++;
index++;
splice.removed.push(old[oldIndex]);
oldIndex++;
break;
case EDIT_ADD:
if (!splice)
splice = newSplice(index, [], 0);
splice.addedCount++;
index++;
break;
case EDIT_DELETE:
if (!splice)
splice = newSplice(index, [], 0);
splice.removed.push(old[oldIndex]);
oldIndex++;
break;
}
}
if (splice) {
splices.push(splice);
}
return splices;
},
sharedPrefix: function (current, old, searchLength) {
for (var i = 0; i < searchLength; i++)
if (!this.equals(current[i], old[i]))
return i;
return searchLength;
},
sharedSuffix: function (current, old, searchLength) {
var index1 = current.length;
var index2 = old.length;
var count = 0;
while (count < searchLength && this.equals(current[--index1], old[--index2]))
count++;
return count;
},
calculateSplices: function (current, previous) {
return this.calcSplices(current, 0, current.length, previous, 0, previous.length);
},
equals: function (currentValue, previousValue) {
return currentValue === previousValue;
}
};
return new ArraySplice();
}();
Polymer.domInnerHTML = function () {
var escapeAttrRegExp = /[&\u00A0"]/g;
var escapeDataRegExp = /[&\u00A0<>]/g;
function escapeReplace(c) {
switch (c) {
case '&':
return '&amp;';
case '<':
return '&lt;';
case '>':
return '&gt;';
case '"':
return '&quot;';
case '\xA0':
return '&nbsp;';
}
}
function escapeAttr(s) {
return s.replace(escapeAttrRegExp, escapeReplace);
}
function escapeData(s) {
return s.replace(escapeDataRegExp, escapeReplace);
}
function makeSet(arr) {
var set = {};
for (var i = 0; i < arr.length; i++) {
set[arr[i]] = true;
}
return set;
}
var voidElements = makeSet([
'area',
'base',
'br',
'col',
'command',
'embed',
'hr',
'img',
'input',
'keygen',
'link',
'meta',
'param',
'source',
'track',
'wbr'
]);
var plaintextParents = makeSet([
'style',
'script',
'xmp',
'iframe',
'noembed',
'noframes',
'plaintext',
'noscript'
]);
function getOuterHTML(node, parentNode, composed) {
switch (node.nodeType) {
case Node.ELEMENT_NODE:
var tagName = node.localName;
var s = '<' + tagName;
var attrs = node.attributes;
for (var i = 0, attr; attr = attrs[i]; i++) {
s += ' ' + attr.name + '="' + escapeAttr(attr.value) + '"';
}
s += '>';
if (voidElements[tagName]) {
return s;
}
return s + getInnerHTML(node, composed) + '</' + tagName + '>';
case Node.TEXT_NODE:
var data = node.data;
if (parentNode && plaintextParents[parentNode.localName]) {
return data;
}
return escapeData(data);
case Node.COMMENT_NODE:
return '<!--' + node.data + '-->';
default:
console.error(node);
throw new Error('not implemented');
}
}
function getInnerHTML(node, composed) {
if (node instanceof HTMLTemplateElement)
node = node.content;
var s = '';
var c$ = Polymer.dom(node).childNodes;
for (var i = 0, l = c$.length, child; i < l && (child = c$[i]); i++) {
s += getOuterHTML(child, node, composed);
}
return s;
}
return { getInnerHTML: getInnerHTML };
}();
(function () {
'use strict';
var nativeInsertBefore = Element.prototype.insertBefore;
var nativeAppendChild = Element.prototype.appendChild;
var nativeRemoveChild = Element.prototype.removeChild;
Polymer.TreeApi = {
arrayCopyChildNodes: function (parent) {
var copy = [], i = 0;
for (var n = parent.firstChild; n; n = n.nextSibling) {
copy[i++] = n;
}
return copy;
},
arrayCopyChildren: function (parent) {
var copy = [], i = 0;
for (var n = parent.firstElementChild; n; n = n.nextElementSibling) {
copy[i++] = n;
}
return copy;
},
arrayCopy: function (a$) {
var l = a$.length;
var copy = new Array(l);
for (var i = 0; i < l; i++) {
copy[i] = a$[i];
}
return copy;
}
};
Polymer.TreeApi.Logical = {
hasParentNode: function (node) {
return Boolean(node.__dom && node.__dom.parentNode);
},
hasChildNodes: function (node) {
return Boolean(node.__dom && node.__dom.childNodes !== undefined);
},
getChildNodes: function (node) {
return this.hasChildNodes(node) ? this._getChildNodes(node) : node.childNodes;
},
_getChildNodes: function (node) {
if (!node.__dom.childNodes) {
node.__dom.childNodes = [];
for (var n = node.__dom.firstChild; n; n = n.__dom.nextSibling) {
node.__dom.childNodes.push(n);
}
}
return node.__dom.childNodes;
},
getParentNode: function (node) {
return node.__dom && node.__dom.parentNode !== undefined ? node.__dom.parentNode : node.parentNode;
},
getFirstChild: function (node) {
return node.__dom && node.__dom.firstChild !== undefined ? node.__dom.firstChild : node.firstChild;
},
getLastChild: function (node) {
return node.__dom && node.__dom.lastChild !== undefined ? node.__dom.lastChild : node.lastChild;
},
getNextSibling: function (node) {
return node.__dom && node.__dom.nextSibling !== undefined ? node.__dom.nextSibling : node.nextSibling;
},
getPreviousSibling: function (node) {
return node.__dom && node.__dom.previousSibling !== undefined ? node.__dom.previousSibling : node.previousSibling;
},
getFirstElementChild: function (node) {
return node.__dom && node.__dom.firstChild !== undefined ? this._getFirstElementChild(node) : node.firstElementChild;
},
_getFirstElementChild: function (node) {
var n = node.__dom.firstChild;
while (n && n.nodeType !== Node.ELEMENT_NODE) {
n = n.__dom.nextSibling;
}
return n;
},
getLastElementChild: function (node) {
return node.__dom && node.__dom.lastChild !== undefined ? this._getLastElementChild(node) : node.lastElementChild;
},
_getLastElementChild: function (node) {
var n = node.__dom.lastChild;
while (n && n.nodeType !== Node.ELEMENT_NODE) {
n = n.__dom.previousSibling;
}
return n;
},
getNextElementSibling: function (node) {
return node.__dom && node.__dom.nextSibling !== undefined ? this._getNextElementSibling(node) : node.nextElementSibling;
},
_getNextElementSibling: function (node) {
var n = node.__dom.nextSibling;
while (n && n.nodeType !== Node.ELEMENT_NODE) {
n = n.__dom.nextSibling;
}
return n;
},
getPreviousElementSibling: function (node) {
return node.__dom && node.__dom.previousSibling !== undefined ? this._getPreviousElementSibling(node) : node.previousElementSibling;
},
_getPreviousElementSibling: function (node) {
var n = node.__dom.previousSibling;
while (n && n.nodeType !== Node.ELEMENT_NODE) {
n = n.__dom.previousSibling;
}
return n;
},
saveChildNodes: function (node) {
if (!this.hasChildNodes(node)) {
node.__dom = node.__dom || {};
node.__dom.firstChild = node.firstChild;
node.__dom.lastChild = node.lastChild;
node.__dom.childNodes = [];
for (var n = node.firstChild; n; n = n.nextSibling) {
n.__dom = n.__dom || {};
n.__dom.parentNode = node;
node.__dom.childNodes.push(n);
n.__dom.nextSibling = n.nextSibling;
n.__dom.previousSibling = n.previousSibling;
}
}
},
recordInsertBefore: function (node, container, ref_node) {
container.__dom.childNodes = null;
if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
for (var n = node.firstChild; n; n = n.nextSibling) {
this._linkNode(n, container, ref_node);
}
} else {
this._linkNode(node, container, ref_node);
}
},
_linkNode: function (node, container, ref_node) {
node.__dom = node.__dom || {};
container.__dom = container.__dom || {};
if (ref_node) {
ref_node.__dom = ref_node.__dom || {};
}
node.__dom.previousSibling = ref_node ? ref_node.__dom.previousSibling : container.__dom.lastChild;
if (node.__dom.previousSibling) {
node.__dom.previousSibling.__dom.nextSibling = node;
}
node.__dom.nextSibling = ref_node;
if (node.__dom.nextSibling) {
node.__dom.nextSibling.__dom.previousSibling = node;
}
node.__dom.parentNode = container;
if (ref_node) {
if (ref_node === container.__dom.firstChild) {
container.__dom.firstChild = node;
}
} else {
container.__dom.lastChild = node;
if (!container.__dom.firstChild) {
container.__dom.firstChild = node;
}
}
container.__dom.childNodes = null;
},
recordRemoveChild: function (node, container) {
node.__dom = node.__dom || {};
container.__dom = container.__dom || {};
if (node === container.__dom.firstChild) {
container.__dom.firstChild = node.__dom.nextSibling;
}
if (node === container.__dom.lastChild) {
container.__dom.lastChild = node.__dom.previousSibling;
}
var p = node.__dom.previousSibling;
var n = node.__dom.nextSibling;
if (p) {
p.__dom.nextSibling = n;
}
if (n) {
n.__dom.previousSibling = p;
}
node.__dom.parentNode = node.__dom.previousSibling = node.__dom.nextSibling = undefined;
container.__dom.childNodes = null;
}
};
Polymer.TreeApi.Composed = {
getChildNodes: function (node) {
return Polymer.TreeApi.arrayCopyChildNodes(node);
},
getParentNode: function (node) {
return node.parentNode;
},
clearChildNodes: function (node) {
node.textContent = '';
},
insertBefore: function (parentNode, newChild, refChild) {
return nativeInsertBefore.call(parentNode, newChild, refChild || null);
},
appendChild: function (parentNode, newChild) {
return nativeAppendChild.call(parentNode, newChild);
},
removeChild: function (parentNode, node) {
return nativeRemoveChild.call(parentNode, node);
}
};
}());
Polymer.DomApi = function () {
'use strict';
var Settings = Polymer.Settings;
var TreeApi = Polymer.TreeApi;
var DomApi = function (node) {
this.node = needsToWrap ? DomApi.wrap(node) : node;
};
var needsToWrap = Settings.hasShadow && !Settings.nativeShadow;
DomApi.wrap = window.wrap ? window.wrap : function (node) {
return node;
};
DomApi.prototype = {
flush: function () {
Polymer.dom.flush();
},
deepContains: function (node) {
if (this.node.contains(node)) {
return true;
}
var n = node;
var doc = node.ownerDocument;
while (n && n !== doc && n !== this.node) {
n = Polymer.dom(n).parentNode || n.host;
}
return n === this.node;
},
queryDistributedElements: function (selector) {
var c$ = this.getEffectiveChildNodes();
var list = [];
for (var i = 0, l = c$.length, c; i < l && (c = c$[i]); i++) {
if (c.nodeType === Node.ELEMENT_NODE && DomApi.matchesSelector.call(c, selector)) {
list.push(c);
}
}
return list;
},
getEffectiveChildNodes: function () {
var list = [];
var c$ = this.childNodes;
for (var i = 0, l = c$.length, c; i < l && (c = c$[i]); i++) {
if (c.localName === CONTENT) {
var d$ = dom(c).getDistributedNodes();
for (var j = 0; j < d$.length; j++) {
list.push(d$[j]);
}
} else {
list.push(c);
}
}
return list;
},
observeNodes: function (callback) {
if (callback) {
if (!this.observer) {
this.observer = this.node.localName === CONTENT ? new DomApi.DistributedNodesObserver(this) : new DomApi.EffectiveNodesObserver(this);
}
return this.observer.addListener(callback);
}
},
unobserveNodes: function (handle) {
if (this.observer) {
this.observer.removeListener(handle);
}
},
notifyObserver: function () {
if (this.observer) {
this.observer.notify();
}
},
_query: function (matcher, node, halter) {
node = node || this.node;
var list = [];
this._queryElements(TreeApi.Logical.getChildNodes(node), matcher, halter, list);
return list;
},
_queryElements: function (elements, matcher, halter, list) {
for (var i = 0, l = elements.length, c; i < l && (c = elements[i]); i++) {
if (c.nodeType === Node.ELEMENT_NODE) {
if (this._queryElement(c, matcher, halter, list)) {
return true;
}
}
}
},
_queryElement: function (node, matcher, halter, list) {
var result = matcher(node);
if (result) {
list.push(node);
}
if (halter && halter(result)) {
return result;
}
this._queryElements(TreeApi.Logical.getChildNodes(node), matcher, halter, list);
}
};
var CONTENT = DomApi.CONTENT = 'content';
var dom = DomApi.factory = function (node) {
node = node || document;
if (!node.__domApi) {
node.__domApi = new DomApi.ctor(node);
}
return node.__domApi;
};
DomApi.hasApi = function (node) {
return Boolean(node.__domApi);
};
DomApi.ctor = DomApi;
Polymer.dom = function (obj, patch) {
if (obj instanceof Event) {
return Polymer.EventApi.factory(obj);
} else {
return DomApi.factory(obj, patch);
}
};
var p = Element.prototype;
DomApi.matchesSelector = p.matches || p.matchesSelector || p.mozMatchesSelector || p.msMatchesSelector || p.oMatchesSelector || p.webkitMatchesSelector;
return DomApi;
}();
(function () {
'use strict';
var Settings = Polymer.Settings;
var DomApi = Polymer.DomApi;
var dom = DomApi.factory;
var TreeApi = Polymer.TreeApi;
var getInnerHTML = Polymer.domInnerHTML.getInnerHTML;
var CONTENT = DomApi.CONTENT;
if (Settings.useShadow) {
return;
}
var nativeCloneNode = Element.prototype.cloneNode;
var nativeImportNode = Document.prototype.importNode;
Polymer.Base.extend(DomApi.prototype, {
_lazyDistribute: function (host) {
if (host.shadyRoot && host.shadyRoot._distributionClean) {
host.shadyRoot._distributionClean = false;
Polymer.dom.addDebouncer(host.debounce('_distribute', host._distributeContent));
}
},
appendChild: function (node) {
return this.insertBefore(node);
},
insertBefore: function (node, ref_node) {
if (ref_node && TreeApi.Logical.getParentNode(ref_node) !== this.node) {
throw Error('The ref_node to be inserted before is not a child ' + 'of this node');
}
if (node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
var parent = TreeApi.Logical.getParentNode(node);
if (parent) {
if (DomApi.hasApi(parent)) {
dom(parent).notifyObserver();
}
this._removeNode(node);
} else {
this._removeOwnerShadyRoot(node);
}
}
if (!this._addNode(node, ref_node)) {
if (ref_node) {
ref_node = ref_node.localName === CONTENT ? this._firstComposedNode(ref_node) : ref_node;
}
var container = this.node._isShadyRoot ? this.node.host : this.node;
if (ref_node) {
TreeApi.Composed.insertBefore(container, node, ref_node);
} else {
TreeApi.Composed.appendChild(container, node);
}
}
this.notifyObserver();
return node;
},
_addNode: function (node, ref_node) {
var root = this.getOwnerRoot();
if (root) {
var ipAdded = this._maybeAddInsertionPoint(node, this.node);
if (!root._invalidInsertionPoints) {
root._invalidInsertionPoints = ipAdded;
}
this._addNodeToHost(root.host, node);
}
if (TreeApi.Logical.hasChildNodes(this.node)) {
TreeApi.Logical.recordInsertBefore(node, this.node, ref_node);
}
var handled = this._maybeDistribute(node) || this.node.shadyRoot;
if (handled) {
if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
while (node.firstChild) {
TreeApi.Composed.removeChild(node, node.firstChild);
}
} else {
var parent = TreeApi.Composed.getParentNode(node);
if (parent) {
TreeApi.Composed.removeChild(parent, node);
}
}
}
return handled;
},
removeChild: function (node) {
if (TreeApi.Logical.getParentNode(node) !== this.node) {
throw Error('The node to be removed is not a child of this node: ' + node);
}
if (!this._removeNode(node)) {
var container = this.node._isShadyRoot ? this.node.host : this.node;
var parent = TreeApi.Composed.getParentNode(node);
if (container === parent) {
TreeApi.Composed.removeChild(container, node);
}
}
this.notifyObserver();
return node;
},
_removeNode: function (node) {
var logicalParent = TreeApi.Logical.hasParentNode(node) && TreeApi.Logical.getParentNode(node);
var distributed;
var root = this._ownerShadyRootForNode(node);
if (logicalParent) {
distributed = dom(node)._maybeDistributeParent();
TreeApi.Logical.recordRemoveChild(node, logicalParent);
if (root && this._removeDistributedChildren(root, node)) {
root._invalidInsertionPoints = true;
this._lazyDistribute(root.host);
}
}
this._removeOwnerShadyRoot(node);
if (root) {
this._removeNodeFromHost(root.host, node);
}
return distributed;
},
replaceChild: function (node, ref_node) {
this.insertBefore(node, ref_node);
this.removeChild(ref_node);
return node;
},
_hasCachedOwnerRoot: function (node) {
return Boolean(node._ownerShadyRoot !== undefined);
},
getOwnerRoot: function () {
return this._ownerShadyRootForNode(this.node);
},
_ownerShadyRootForNode: function (node) {
if (!node) {
return;
}
var root = node._ownerShadyRoot;
if (root === undefined) {
if (node._isShadyRoot) {
root = node;
} else {
var parent = TreeApi.Logical.getParentNode(node);
if (parent) {
root = parent._isShadyRoot ? parent : this._ownerShadyRootForNode(parent);
} else {
root = null;
}
}
if (root || document.documentElement.contains(node)) {
node._ownerShadyRoot = root;
}
}
return root;
},
_maybeDistribute: function (node) {
var fragContent = node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && !node.__noContent && dom(node).querySelector(CONTENT);
var wrappedContent = fragContent && TreeApi.Logical.getParentNode(fragContent).nodeType !== Node.DOCUMENT_FRAGMENT_NODE;
var hasContent = fragContent || node.localName === CONTENT;
if (hasContent) {
var root = this.getOwnerRoot();
if (root) {
this._lazyDistribute(root.host);
}
}
var needsDist = this._nodeNeedsDistribution(this.node);
if (needsDist) {
this._lazyDistribute(this.node);
}
return needsDist || hasContent && !wrappedContent;
},
_maybeAddInsertionPoint: function (node, parent) {
var added;
if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && !node.__noContent) {
var c$ = dom(node).querySelectorAll(CONTENT);
for (var i = 0, n, np, na; i < c$.length && (n = c$[i]); i++) {
np = TreeApi.Logical.getParentNode(n);
if (np === node) {
np = parent;
}
na = this._maybeAddInsertionPoint(n, np);
added = added || na;
}
} else if (node.localName === CONTENT) {
TreeApi.Logical.saveChildNodes(parent);
TreeApi.Logical.saveChildNodes(node);
added = true;
}
return added;
},
_updateInsertionPoints: function (host) {
var i$ = host.shadyRoot._insertionPoints = dom(host.shadyRoot).querySelectorAll(CONTENT);
for (var i = 0, c; i < i$.length; i++) {
c = i$[i];
TreeApi.Logical.saveChildNodes(c);
TreeApi.Logical.saveChildNodes(TreeApi.Logical.getParentNode(c));
}
},
_nodeNeedsDistribution: function (node) {
return node && node.shadyRoot && DomApi.hasInsertionPoint(node.shadyRoot);
},
_addNodeToHost: function (host, node) {
if (host._elementAdd) {
host._elementAdd(node);
}
},
_removeNodeFromHost: function (host, node) {
if (host._elementRemove) {
host._elementRemove(node);
}
},
_removeDistributedChildren: function (root, container) {
var hostNeedsDist;
var ip$ = root._insertionPoints;
for (var i = 0; i < ip$.length; i++) {
var content = ip$[i];
if (this._contains(container, content)) {
var dc$ = dom(content).getDistributedNodes();
for (var j = 0; j < dc$.length; j++) {
hostNeedsDist = true;
var node = dc$[j];
var parent = TreeApi.Composed.getParentNode(node);
if (parent) {
TreeApi.Composed.removeChild(parent, node);
}
}
}
}
return hostNeedsDist;
},
_contains: function (container, node) {
while (node) {
if (node == container) {
return true;
}
node = TreeApi.Logical.getParentNode(node);
}
},
_removeOwnerShadyRoot: function (node) {
if (this._hasCachedOwnerRoot(node)) {
var c$ = TreeApi.Logical.getChildNodes(node);
for (var i = 0, l = c$.length, n; i < l && (n = c$[i]); i++) {
this._removeOwnerShadyRoot(n);
}
}
node._ownerShadyRoot = undefined;
},
_firstComposedNode: function (content) {
var n$ = dom(content).getDistributedNodes();
for (var i = 0, l = n$.length, n, p$; i < l && (n = n$[i]); i++) {
p$ = dom(n).getDestinationInsertionPoints();
if (p$[p$.length - 1] === content) {
return n;
}
}
},
querySelector: function (selector) {
var result = this._query(function (n) {
return DomApi.matchesSelector.call(n, selector);
}, this.node, function (n) {
return Boolean(n);
})[0];
return result || null;
},
querySelectorAll: function (selector) {
return this._query(function (n) {
return DomApi.matchesSelector.call(n, selector);
}, this.node);
},
getDestinationInsertionPoints: function () {
return this.node._destinationInsertionPoints || [];
},
getDistributedNodes: function () {
return this.node._distributedNodes || [];
},
_clear: function () {
while (this.childNodes.length) {
this.removeChild(this.childNodes[0]);
}
},
setAttribute: function (name, value) {
this.node.setAttribute(name, value);
this._maybeDistributeParent();
},
removeAttribute: function (name) {
this.node.removeAttribute(name);
this._maybeDistributeParent();
},
_maybeDistributeParent: function () {
if (this._nodeNeedsDistribution(this.parentNode)) {
this._lazyDistribute(this.parentNode);
return true;
}
},
cloneNode: function (deep) {
var n = nativeCloneNode.call(this.node, false);
if (deep) {
var c$ = this.childNodes;
var d = dom(n);
for (var i = 0, nc; i < c$.length; i++) {
nc = dom(c$[i]).cloneNode(true);
d.appendChild(nc);
}
}
return n;
},
importNode: function (externalNode, deep) {
var doc = this.node instanceof Document ? this.node : this.node.ownerDocument;
var n = nativeImportNode.call(doc, externalNode, false);
if (deep) {
var c$ = TreeApi.Logical.getChildNodes(externalNode);
var d = dom(n);
for (var i = 0, nc; i < c$.length; i++) {
nc = dom(doc).importNode(c$[i], true);
d.appendChild(nc);
}
}
return n;
},
_getComposedInnerHTML: function () {
return getInnerHTML(this.node, true);
}
});
Object.defineProperties(DomApi.prototype, {
activeElement: {
get: function () {
var active = document.activeElement;
if (!active) {
return null;
}
var isShadyRoot = !!this.node._isShadyRoot;
if (this.node !== document) {
if (!isShadyRoot) {
return null;
}
if (this.node.host === active || !this.node.host.contains(active)) {
return null;
}
}
var activeRoot = dom(active).getOwnerRoot();
while (activeRoot && activeRoot !== this.node) {
active = activeRoot.host;
activeRoot = dom(active).getOwnerRoot();
}
if (this.node === document) {
return activeRoot ? null : active;
} else {
return activeRoot === this.node ? active : null;
}
},
configurable: true
},
childNodes: {
get: function () {
var c$ = TreeApi.Logical.getChildNodes(this.node);
return Array.isArray(c$) ? c$ : TreeApi.arrayCopyChildNodes(this.node);
},
configurable: true
},
children: {
get: function () {
if (TreeApi.Logical.hasChildNodes(this.node)) {
return Array.prototype.filter.call(this.childNodes, function (n) {
return n.nodeType === Node.ELEMENT_NODE;
});
} else {
return TreeApi.arrayCopyChildren(this.node);
}
},
configurable: true
},
parentNode: {
get: function () {
return TreeApi.Logical.getParentNode(this.node);
},
configurable: true
},
firstChild: {
get: function () {
return TreeApi.Logical.getFirstChild(this.node);
},
configurable: true
},
lastChild: {
get: function () {
return TreeApi.Logical.getLastChild(this.node);
},
configurable: true
},
nextSibling: {
get: function () {
return TreeApi.Logical.getNextSibling(this.node);
},
configurable: true
},
previousSibling: {
get: function () {
return TreeApi.Logical.getPreviousSibling(this.node);
},
configurable: true
},
firstElementChild: {
get: function () {
return TreeApi.Logical.getFirstElementChild(this.node);
},
configurable: true
},
lastElementChild: {
get: function () {
return TreeApi.Logical.getLastElementChild(this.node);
},
configurable: true
},
nextElementSibling: {
get: function () {
return TreeApi.Logical.getNextElementSibling(this.node);
},
configurable: true
},
previousElementSibling: {
get: function () {
return TreeApi.Logical.getPreviousElementSibling(this.node);
},
configurable: true
},
textContent: {
get: function () {
var nt = this.node.nodeType;
if (nt === Node.TEXT_NODE || nt === Node.COMMENT_NODE) {
return this.node.textContent;
} else {
var tc = [];
for (var i = 0, cn = this.childNodes, c; c = cn[i]; i++) {
if (c.nodeType !== Node.COMMENT_NODE) {
tc.push(c.textContent);
}
}
return tc.join('');
}
},
set: function (text) {
var nt = this.node.nodeType;
if (nt === Node.TEXT_NODE || nt === Node.COMMENT_NODE) {
this.node.textContent = text;
} else {
this._clear();
if (text) {
this.appendChild(document.createTextNode(text));
}
}
},
configurable: true
},
innerHTML: {
get: function () {
var nt = this.node.nodeType;
if (nt === Node.TEXT_NODE || nt === Node.COMMENT_NODE) {
return null;
} else {
return getInnerHTML(this.node);
}
},
set: function (text) {
var nt = this.node.nodeType;
if (nt !== Node.TEXT_NODE || nt !== Node.COMMENT_NODE) {
this._clear();
var d = document.createElement('div');
d.innerHTML = text;
var c$ = TreeApi.arrayCopyChildNodes(d);
for (var i = 0; i < c$.length; i++) {
this.appendChild(c$[i]);
}
}
},
configurable: true
}
});
DomApi.hasInsertionPoint = function (root) {
return Boolean(root && root._insertionPoints.length);
};
}());
(function () {
'use strict';
var Settings = Polymer.Settings;
var TreeApi = Polymer.TreeApi;
var DomApi = Polymer.DomApi;
if (!Settings.useShadow) {
return;
}
Polymer.Base.extend(DomApi.prototype, {
querySelectorAll: function (selector) {
return TreeApi.arrayCopy(this.node.querySelectorAll(selector));
},
getOwnerRoot: function () {
var n = this.node;
while (n) {
if (n.nodeType === Node.DOCUMENT_FRAGMENT_NODE && n.host) {
return n;
}
n = n.parentNode;
}
},
importNode: function (externalNode, deep) {
var doc = this.node instanceof Document ? this.node : this.node.ownerDocument;
return doc.importNode(externalNode, deep);
},
getDestinationInsertionPoints: function () {
var n$ = this.node.getDestinationInsertionPoints && this.node.getDestinationInsertionPoints();
return n$ ? TreeApi.arrayCopy(n$) : [];
},
getDistributedNodes: function () {
var n$ = this.node.getDistributedNodes && this.node.getDistributedNodes();
return n$ ? TreeApi.arrayCopy(n$) : [];
}
});
Object.defineProperties(DomApi.prototype, {
activeElement: {
get: function () {
var node = DomApi.wrap(this.node);
var activeElement = node.activeElement;
return node.contains(activeElement) ? activeElement : null;
},
configurable: true
},
childNodes: {
get: function () {
return TreeApi.arrayCopyChildNodes(this.node);
},
configurable: true
},
children: {
get: function () {
return TreeApi.arrayCopyChildren(this.node);
},
configurable: true
},
textContent: {
get: function () {
return this.node.textContent;
},
set: function (value) {
return this.node.textContent = value;
},
configurable: true
},
innerHTML: {
get: function () {
return this.node.innerHTML;
},
set: function (value) {
return this.node.innerHTML = value;
},
configurable: true
}
});
var forwardMethods = function (m$) {
for (var i = 0; i < m$.length; i++) {
forwardMethod(m$[i]);
}
};
var forwardMethod = function (method) {
DomApi.prototype[method] = function () {
return this.node[method].apply(this.node, arguments);
};
};
forwardMethods([
'cloneNode',
'appendChild',
'insertBefore',
'removeChild',
'replaceChild',
'setAttribute',
'removeAttribute',
'querySelector'
]);
var forwardProperties = function (f$) {
for (var i = 0; i < f$.length; i++) {
forwardProperty(f$[i]);
}
};
var forwardProperty = function (name) {
Object.defineProperty(DomApi.prototype, name, {
get: function () {
return this.node[name];
},
configurable: true
});
};
forwardProperties([
'parentNode',
'firstChild',
'lastChild',
'nextSibling',
'previousSibling',
'firstElementChild',
'lastElementChild',
'nextElementSibling',
'previousElementSibling'
]);
}());
Polymer.Base.extend(Polymer.dom, {
_flushGuard: 0,
_FLUSH_MAX: 100,
_needsTakeRecords: !Polymer.Settings.useNativeCustomElements,
_debouncers: [],
_staticFlushList: [],
_finishDebouncer: null,
flush: function () {
this._flushGuard = 0;
this._prepareFlush();
while (this._debouncers.length && this._flushGuard < this._FLUSH_MAX) {
while (this._debouncers.length) {
this._debouncers.shift().complete();
}
if (this._finishDebouncer) {
this._finishDebouncer.complete();
}
this._prepareFlush();
this._flushGuard++;
}
if (this._flushGuard >= this._FLUSH_MAX) {
console.warn('Polymer.dom.flush aborted. Flush may not be complete.');
}
},
_prepareFlush: function () {
if (this._needsTakeRecords) {
CustomElements.takeRecords();
}
for (var i = 0; i < this._staticFlushList.length; i++) {
this._staticFlushList[i]();
}
},
addStaticFlush: function (fn) {
this._staticFlushList.push(fn);
},
removeStaticFlush: function (fn) {
var i = this._staticFlushList.indexOf(fn);
if (i >= 0) {
this._staticFlushList.splice(i, 1);
}
},
addDebouncer: function (debouncer) {
this._debouncers.push(debouncer);
this._finishDebouncer = Polymer.Debounce(this._finishDebouncer, this._finishFlush);
},
_finishFlush: function () {
Polymer.dom._debouncers = [];
}
});
Polymer.EventApi = function () {
'use strict';
var DomApi = Polymer.DomApi.ctor;
var Settings = Polymer.Settings;
DomApi.Event = function (event) {
this.event = event;
};
if (Settings.useShadow) {
DomApi.Event.prototype = {
get rootTarget() {
return this.event.path[0];
},
get localTarget() {
return this.event.target;
},
get path() {
var path = this.event.path;
if (!Array.isArray(path)) {
path = Array.prototype.slice.call(path);
}
return path;
}
};
} else {
DomApi.Event.prototype = {
get rootTarget() {
return this.event.target;
},
get localTarget() {
var current = this.event.currentTarget;
var currentRoot = current && Polymer.dom(current).getOwnerRoot();
var p$ = this.path;
for (var i = 0; i < p$.length; i++) {
if (Polymer.dom(p$[i]).getOwnerRoot() === currentRoot) {
return p$[i];
}
}
},
get path() {
if (!this.event._path) {
var path = [];
var current = this.rootTarget;
while (current) {
path.push(current);
var insertionPoints = Polymer.dom(current).getDestinationInsertionPoints();
if (insertionPoints.length) {
for (var i = 0; i < insertionPoints.length - 1; i++) {
path.push(insertionPoints[i]);
}
current = insertionPoints[insertionPoints.length - 1];
} else {
current = Polymer.dom(current).parentNode || current.host;
}
}
path.push(window);
this.event._path = path;
}
return this.event._path;
}
};
}
var factory = function (event) {
if (!event.__eventApi) {
event.__eventApi = new DomApi.Event(event);
}
return event.__eventApi;
};
return { factory: factory };
}();
(function () {
'use strict';
var DomApi = Polymer.DomApi.ctor;
var useShadow = Polymer.Settings.useShadow;
Object.defineProperty(DomApi.prototype, 'classList', {
get: function () {
if (!this._classList) {
this._classList = new DomApi.ClassList(this);
}
return this._classList;
},
configurable: true
});
DomApi.ClassList = function (host) {
this.domApi = host;
this.node = host.node;
};
DomApi.ClassList.prototype = {
add: function () {
this.node.classList.add.apply(this.node.classList, arguments);
this._distributeParent();
},
remove: function () {
this.node.classList.remove.apply(this.node.classList, arguments);
this._distributeParent();
},
toggle: function () {
this.node.classList.toggle.apply(this.node.classList, arguments);
this._distributeParent();
},
_distributeParent: function () {
if (!useShadow) {
this.domApi._maybeDistributeParent();
}
},
contains: function () {
return this.node.classList.contains.apply(this.node.classList, arguments);
}
};
}());
(function () {
'use strict';
var DomApi = Polymer.DomApi.ctor;
var Settings = Polymer.Settings;
DomApi.EffectiveNodesObserver = function (domApi) {
this.domApi = domApi;
this.node = this.domApi.node;
this._listeners = [];
};
DomApi.EffectiveNodesObserver.prototype = {
addListener: function (callback) {
if (!this._isSetup) {
this._setup();
this._isSetup = true;
}
var listener = {
fn: callback,
_nodes: []
};
this._listeners.push(listener);
this._scheduleNotify();
return listener;
},
removeListener: function (handle) {
var i = this._listeners.indexOf(handle);
if (i >= 0) {
this._listeners.splice(i, 1);
handle._nodes = [];
}
if (!this._hasListeners()) {
this._cleanup();
this._isSetup = false;
}
},
_setup: function () {
this._observeContentElements(this.domApi.childNodes);
},
_cleanup: function () {
this._unobserveContentElements(this.domApi.childNodes);
},
_hasListeners: function () {
return Boolean(this._listeners.length);
},
_scheduleNotify: function () {
if (this._debouncer) {
this._debouncer.stop();
}
this._debouncer = Polymer.Debounce(this._debouncer, this._notify);
this._debouncer.context = this;
Polymer.dom.addDebouncer(this._debouncer);
},
notify: function () {
if (this._hasListeners()) {
this._scheduleNotify();
}
},
_notify: function () {
this._beforeCallListeners();
this._callListeners();
},
_beforeCallListeners: function () {
this._updateContentElements();
},
_updateContentElements: function () {
this._observeContentElements(this.domApi.childNodes);
},
_observeContentElements: function (elements) {
for (var i = 0, n; i < elements.length && (n = elements[i]); i++) {
if (this._isContent(n)) {
n.__observeNodesMap = n.__observeNodesMap || new WeakMap();
if (!n.__observeNodesMap.has(this)) {
n.__observeNodesMap.set(this, this._observeContent(n));
}
}
}
},
_observeContent: function (content) {
var self = this;
var h = Polymer.dom(content).observeNodes(function () {
self._scheduleNotify();
});
h._avoidChangeCalculation = true;
return h;
},
_unobserveContentElements: function (elements) {
for (var i = 0, n, h; i < elements.length && (n = elements[i]); i++) {
if (this._isContent(n)) {
h = n.__observeNodesMap.get(this);
if (h) {
Polymer.dom(n).unobserveNodes(h);
n.__observeNodesMap.delete(this);
}
}
}
},
_isContent: function (node) {
return node.localName === 'content';
},
_callListeners: function () {
var o$ = this._listeners;
var nodes = this._getEffectiveNodes();
for (var i = 0, o; i < o$.length && (o = o$[i]); i++) {
var info = this._generateListenerInfo(o, nodes);
if (info || o._alwaysNotify) {
this._callListener(o, info);
}
}
},
_getEffectiveNodes: function () {
return this.domApi.getEffectiveChildNodes();
},
_generateListenerInfo: function (listener, newNodes) {
if (listener._avoidChangeCalculation) {
return true;
}
var oldNodes = listener._nodes;
var info = {
target: this.node,
addedNodes: [],
removedNodes: []
};
var splices = Polymer.ArraySplice.calculateSplices(newNodes, oldNodes);
for (var i = 0, s; i < splices.length && (s = splices[i]); i++) {
for (var j = 0, n; j < s.removed.length && (n = s.removed[j]); j++) {
info.removedNodes.push(n);
}
}
for (i = 0, s; i < splices.length && (s = splices[i]); i++) {
for (j = s.index; j < s.index + s.addedCount; j++) {
info.addedNodes.push(newNodes[j]);
}
}
listener._nodes = newNodes;
if (info.addedNodes.length || info.removedNodes.length) {
return info;
}
},
_callListener: function (listener, info) {
return listener.fn.call(this.node, info);
},
enableShadowAttributeTracking: function () {
}
};
if (Settings.useShadow) {
var baseSetup = DomApi.EffectiveNodesObserver.prototype._setup;
var baseCleanup = DomApi.EffectiveNodesObserver.prototype._cleanup;
Polymer.Base.extend(DomApi.EffectiveNodesObserver.prototype, {
_setup: function () {
if (!this._observer) {
var self = this;
this._mutationHandler = function (mxns) {
if (mxns && mxns.length) {
self._scheduleNotify();
}
};
this._observer = new MutationObserver(this._mutationHandler);
this._boundFlush = function () {
self._flush();
};
Polymer.dom.addStaticFlush(this._boundFlush);
this._observer.observe(this.node, { childList: true });
}
baseSetup.call(this);
},
_cleanup: function () {
this._observer.disconnect();
this._observer = null;
this._mutationHandler = null;
Polymer.dom.removeStaticFlush(this._boundFlush);
baseCleanup.call(this);
},
_flush: function () {
if (this._observer) {
this._mutationHandler(this._observer.takeRecords());
}
},
enableShadowAttributeTracking: function () {
if (this._observer) {
this._makeContentListenersAlwaysNotify();
this._observer.disconnect();
this._observer.observe(this.node, {
childList: true,
attributes: true,
subtree: true
});
var root = this.domApi.getOwnerRoot();
var host = root && root.host;
if (host && Polymer.dom(host).observer) {
Polymer.dom(host).observer.enableShadowAttributeTracking();
}
}
},
_makeContentListenersAlwaysNotify: function () {
for (var i = 0, h; i < this._listeners.length; i++) {
h = this._listeners[i];
h._alwaysNotify = h._isContentListener;
}
}
});
}
}());
(function () {
'use strict';
var DomApi = Polymer.DomApi.ctor;
var Settings = Polymer.Settings;
DomApi.DistributedNodesObserver = function (domApi) {
DomApi.EffectiveNodesObserver.call(this, domApi);
};
DomApi.DistributedNodesObserver.prototype = Object.create(DomApi.EffectiveNodesObserver.prototype);
Polymer.Base.extend(DomApi.DistributedNodesObserver.prototype, {
_setup: function () {
},
_cleanup: function () {
},
_beforeCallListeners: function () {
},
_getEffectiveNodes: function () {
return this.domApi.getDistributedNodes();
}
});
if (Settings.useShadow) {
Polymer.Base.extend(DomApi.DistributedNodesObserver.prototype, {
_setup: function () {
if (!this._observer) {
var root = this.domApi.getOwnerRoot();
var host = root && root.host;
if (host) {
var self = this;
this._observer = Polymer.dom(host).observeNodes(function () {
self._scheduleNotify();
});
this._observer._isContentListener = true;
if (this._hasAttrSelect()) {
Polymer.dom(host).observer.enableShadowAttributeTracking();
}
}
}
},
_hasAttrSelect: function () {
var select = this.node.getAttribute('select');
return select && select.match(/[[.]+/);
},
_cleanup: function () {
var root = this.domApi.getOwnerRoot();
var host = root && root.host;
if (host) {
Polymer.dom(host).unobserveNodes(this._observer);
}
this._observer = null;
}
});
}
}());
(function () {
var DomApi = Polymer.DomApi;
var TreeApi = Polymer.TreeApi;
Polymer.Base._addFeature({
_prepShady: function () {
this._useContent = this._useContent || Boolean(this._template);
},
_setupShady: function () {
this.shadyRoot = null;
if (!this.__domApi) {
this.__domApi = null;
}
if (!this.__dom) {
this.__dom = null;
}
if (!this._ownerShadyRoot) {
this._ownerShadyRoot = undefined;
}
},
_poolContent: function () {
if (this._useContent) {
TreeApi.Logical.saveChildNodes(this);
}
},
_setupRoot: function () {
if (this._useContent) {
this._createLocalRoot();
if (!this.dataHost) {
upgradeLogicalChildren(TreeApi.Logical.getChildNodes(this));
}
}
},
_createLocalRoot: function () {
this.shadyRoot = this.root;
this.shadyRoot._distributionClean = false;
this.shadyRoot._hasDistributed = false;
this.shadyRoot._isShadyRoot = true;
this.shadyRoot._dirtyRoots = [];
var i$ = this.shadyRoot._insertionPoints = !this._notes || this._notes._hasContent ? this.shadyRoot.querySelectorAll('content') : [];
TreeApi.Logical.saveChildNodes(this.shadyRoot);
for (var i = 0, c; i < i$.length; i++) {
c = i$[i];
TreeApi.Logical.saveChildNodes(c);
TreeApi.Logical.saveChildNodes(c.parentNode);
}
this.shadyRoot.host = this;
},
get domHost() {
var root = Polymer.dom(this).getOwnerRoot();
return root && root.host;
},
distributeContent: function (updateInsertionPoints) {
if (this.shadyRoot) {
this.shadyRoot._invalidInsertionPoints = this.shadyRoot._invalidInsertionPoints || updateInsertionPoints;
var host = getTopDistributingHost(this);
Polymer.dom(this)._lazyDistribute(host);
}
},
_distributeContent: function () {
if (this._useContent && !this.shadyRoot._distributionClean) {
if (this.shadyRoot._invalidInsertionPoints) {
Polymer.dom(this)._updateInsertionPoints(this);
this.shadyRoot._invalidInsertionPoints = false;
}
this._beginDistribute();
this._distributeDirtyRoots();
this._finishDistribute();
}
},
_beginDistribute: function () {
if (this._useContent && DomApi.hasInsertionPoint(this.shadyRoot)) {
this._resetDistribution();
this._distributePool(this.shadyRoot, this._collectPool());
}
},
_distributeDirtyRoots: function () {
var c$ = this.shadyRoot._dirtyRoots;
for (var i = 0, l = c$.length, c; i < l && (c = c$[i]); i++) {
c._distributeContent();
}
this.shadyRoot._dirtyRoots = [];
},
_finishDistribute: function () {
if (this._useContent) {
this.shadyRoot._distributionClean = true;
if (DomApi.hasInsertionPoint(this.shadyRoot)) {
this._composeTree();
notifyContentObservers(this.shadyRoot);
} else {
if (!this.shadyRoot._hasDistributed) {
TreeApi.Composed.clearChildNodes(this);
this.appendChild(this.shadyRoot);
} else {
var children = this._composeNode(this);
this._updateChildNodes(this, children);
}
}
if (!this.shadyRoot._hasDistributed) {
notifyInitialDistribution(this);
}
this.shadyRoot._hasDistributed = true;
}
},
elementMatches: function (selector, node) {
node = node || this;
return DomApi.matchesSelector.call(node, selector);
},
_resetDistribution: function () {
var children = TreeApi.Logical.getChildNodes(this);
for (var i = 0; i < children.length; i++) {
var child = children[i];
if (child._destinationInsertionPoints) {
child._destinationInsertionPoints = undefined;
}
if (isInsertionPoint(child)) {
clearDistributedDestinationInsertionPoints(child);
}
}
var root = this.shadyRoot;
var p$ = root._insertionPoints;
for (var j = 0; j < p$.length; j++) {
p$[j]._distributedNodes = [];
}
},
_collectPool: function () {
var pool = [];
var children = TreeApi.Logical.getChildNodes(this);
for (var i = 0; i < children.length; i++) {
var child = children[i];
if (isInsertionPoint(child)) {
pool.push.apply(pool, child._distributedNodes);
} else {
pool.push(child);
}
}
return pool;
},
_distributePool: function (node, pool) {
var p$ = node._insertionPoints;
for (var i = 0, l = p$.length, p; i < l && (p = p$[i]); i++) {
this._distributeInsertionPoint(p, pool);
maybeRedistributeParent(p, this);
}
},
_distributeInsertionPoint: function (content, pool) {
var anyDistributed = false;
for (var i = 0, l = pool.length, node; i < l; i++) {
node = pool[i];
if (!node) {
continue;
}
if (this._matchesContentSelect(node, content)) {
distributeNodeInto(node, content);
pool[i] = undefined;
anyDistributed = true;
}
}
if (!anyDistributed) {
var children = TreeApi.Logical.getChildNodes(content);
for (var j = 0; j < children.length; j++) {
distributeNodeInto(children[j], content);
}
}
},
_composeTree: function () {
this._updateChildNodes(this, this._composeNode(this));
var p$ = this.shadyRoot._insertionPoints;
for (var i = 0, l = p$.length, p, parent; i < l && (p = p$[i]); i++) {
parent = TreeApi.Logical.getParentNode(p);
if (!parent._useContent && parent !== this && parent !== this.shadyRoot) {
this._updateChildNodes(parent, this._composeNode(parent));
}
}
},
_composeNode: function (node) {
var children = [];
var c$ = TreeApi.Logical.getChildNodes(node.shadyRoot || node);
for (var i = 0; i < c$.length; i++) {
var child = c$[i];
if (isInsertionPoint(child)) {
var distributedNodes = child._distributedNodes;
for (var j = 0; j < distributedNodes.length; j++) {
var distributedNode = distributedNodes[j];
if (isFinalDestination(child, distributedNode)) {
children.push(distributedNode);
}
}
} else {
children.push(child);
}
}
return children;
},
_updateChildNodes: function (container, children) {
var composed = TreeApi.Composed.getChildNodes(container);
var splices = Polymer.ArraySplice.calculateSplices(children, composed);
for (var i = 0, d = 0, s; i < splices.length && (s = splices[i]); i++) {
for (var j = 0, n; j < s.removed.length && (n = s.removed[j]); j++) {
if (TreeApi.Composed.getParentNode(n) === container) {
TreeApi.Composed.removeChild(container, n);
}
composed.splice(s.index + d, 1);
}
d -= s.addedCount;
}
for (var i = 0, s, next; i < splices.length && (s = splices[i]); i++) {
next = composed[s.index];
for (j = s.index, n; j < s.index + s.addedCount; j++) {
n = children[j];
TreeApi.Composed.insertBefore(container, n, next);
composed.splice(j, 0, n);
}
}
},
_matchesContentSelect: function (node, contentElement) {
var select = contentElement.getAttribute('select');
if (!select) {
return true;
}
select = select.trim();
if (!select) {
return true;
}
if (!(node instanceof Element)) {
return false;
}
var validSelectors = /^(:not\()?[*.#[a-zA-Z_|]/;
if (!validSelectors.test(select)) {
return false;
}
return this.elementMatches(select, node);
},
_elementAdd: function () {
},
_elementRemove: function () {
}
});
function distributeNodeInto(child, insertionPoint) {
insertionPoint._distributedNodes.push(child);
var points = child._destinationInsertionPoints;
if (!points) {
child._destinationInsertionPoints = [insertionPoint];
} else {
points.push(insertionPoint);
}
}
function clearDistributedDestinationInsertionPoints(content) {
var e$ = content._distributedNodes;
if (e$) {
for (var i = 0; i < e$.length; i++) {
var d = e$[i]._destinationInsertionPoints;
if (d) {
d.splice(d.indexOf(content) + 1, d.length);
}
}
}
}
function maybeRedistributeParent(content, host) {
var parent = TreeApi.Logical.getParentNode(content);
if (parent && parent.shadyRoot && DomApi.hasInsertionPoint(parent.shadyRoot) && parent.shadyRoot._distributionClean) {
parent.shadyRoot._distributionClean = false;
host.shadyRoot._dirtyRoots.push(parent);
}
}
function isFinalDestination(insertionPoint, node) {
var points = node._destinationInsertionPoints;
return points && points[points.length - 1] === insertionPoint;
}
function isInsertionPoint(node) {
return node.localName == 'content';
}
function getTopDistributingHost(host) {
while (host && hostNeedsRedistribution(host)) {
host = host.domHost;
}
return host;
}
function hostNeedsRedistribution(host) {
var c$ = TreeApi.Logical.getChildNodes(host);
for (var i = 0, c; i < c$.length; i++) {
c = c$[i];
if (c.localName && c.localName === 'content') {
return host.domHost;
}
}
}
function notifyContentObservers(root) {
for (var i = 0, c; i < root._insertionPoints.length; i++) {
c = root._insertionPoints[i];
if (DomApi.hasApi(c)) {
Polymer.dom(c).notifyObserver();
}
}
}
function notifyInitialDistribution(host) {
if (DomApi.hasApi(host)) {
Polymer.dom(host).notifyObserver();
}
}
var needsUpgrade = window.CustomElements && !CustomElements.useNative;
function upgradeLogicalChildren(children) {
if (needsUpgrade && children) {
for (var i = 0; i < children.length; i++) {
CustomElements.upgrade(children[i]);
}
}
}
}());
if (Polymer.Settings.useShadow) {
Polymer.Base._addFeature({
_poolContent: function () {
},
_beginDistribute: function () {
},
distributeContent: function () {
},
_distributeContent: function () {
},
_finishDistribute: function () {
},
_createLocalRoot: function () {
this.createShadowRoot();
this.shadowRoot.appendChild(this.root);
this.root = this.shadowRoot;
}
});
}
Polymer.Async = {
_currVal: 0,
_lastVal: 0,
_callbacks: [],
_twiddleContent: 0,
_twiddle: document.createTextNode(''),
run: function (callback, waitTime) {
if (waitTime > 0) {
return ~setTimeout(callback, waitTime);
} else {
this._twiddle.textContent = this._twiddleContent++;
this._callbacks.push(callback);
return this._currVal++;
}
},
cancel: function (handle) {
if (handle < 0) {
clearTimeout(~handle);
} else {
var idx = handle - this._lastVal;
if (idx >= 0) {
if (!this._callbacks[idx]) {
throw 'invalid async handle: ' + handle;
}
this._callbacks[idx] = null;
}
}
},
_atEndOfMicrotask: function () {
var len = this._callbacks.length;
for (var i = 0; i < len; i++) {
var cb = this._callbacks[i];
if (cb) {
try {
cb();
} catch (e) {
i++;
this._callbacks.splice(0, i);
this._lastVal += i;
this._twiddle.textContent = this._twiddleContent++;
throw e;
}
}
}
this._callbacks.splice(0, len);
this._lastVal += len;
}
};
new window.MutationObserver(function () {
Polymer.Async._atEndOfMicrotask();
}).observe(Polymer.Async._twiddle, { characterData: true });
Polymer.Debounce = function () {
var Async = Polymer.Async;
var Debouncer = function (context) {
this.context = context;
var self = this;
this.boundComplete = function () {
self.complete();
};
};
Debouncer.prototype = {
go: function (callback, wait) {
var h;
this.finish = function () {
Async.cancel(h);
};
h = Async.run(this.boundComplete, wait);
this.callback = callback;
},
stop: function () {
if (this.finish) {
this.finish();
this.finish = null;
this.callback = null;
}
},
complete: function () {
if (this.finish) {
var callback = this.callback;
this.stop();
callback.call(this.context);
}
}
};
function debounce(debouncer, callback, wait) {
if (debouncer) {
debouncer.stop();
} else {
debouncer = new Debouncer(this);
}
debouncer.go(callback, wait);
return debouncer;
}
return debounce;
}();
Polymer.Base._addFeature({
_setupDebouncers: function () {
this._debouncers = {};
},
debounce: function (jobName, callback, wait) {
return this._debouncers[jobName] = Polymer.Debounce.call(this, this._debouncers[jobName], callback, wait);
},
isDebouncerActive: function (jobName) {
var debouncer = this._debouncers[jobName];
return !!(debouncer && debouncer.finish);
},
flushDebouncer: function (jobName) {
var debouncer = this._debouncers[jobName];
if (debouncer) {
debouncer.complete();
}
},
cancelDebouncer: function (jobName) {
var debouncer = this._debouncers[jobName];
if (debouncer) {
debouncer.stop();
}
}
});
Polymer.DomModule = document.createElement('dom-module');
Polymer.Base._addFeature({
_registerFeatures: function () {
this._prepIs();
this._prepBehaviors();
this._prepConstructor();
this._prepTemplate();
this._prepShady();
this._prepPropertyInfo();
},
_prepBehavior: function (b) {
this._addHostAttributes(b.hostAttributes);
},
_initFeatures: function () {
this._registerHost();
if (this._template) {
this._poolContent();
this._beginHosting();
this._stampTemplate();
this._endHosting();
}
this._marshalHostAttributes();
this._setupDebouncers();
this._marshalBehaviors();
this._tryReady();
},
_marshalBehavior: function (b) {
}
});
Polymer.nar = [];
Polymer.Annotations = {
parseAnnotations: function (template) {
var list = [];
var content = template._content || template.content;
this._parseNodeAnnotations(content, list, template.hasAttribute('strip-whitespace'));
return list;
},
_parseNodeAnnotations: function (node, list, stripWhiteSpace) {
return node.nodeType === Node.TEXT_NODE ? this._parseTextNodeAnnotation(node, list) : this._parseElementAnnotations(node, list, stripWhiteSpace);
},
_bindingRegex: function () {
var IDENT = '(?:' + '[a-zA-Z_$][\\w.:$\\-*]*' + ')';
var NUMBER = '(?:' + '[-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?' + ')';
var SQUOTE_STRING = '(?:' + '\'(?:[^\'\\\\]|\\\\.)*\'' + ')';
var DQUOTE_STRING = '(?:' + '"(?:[^"\\\\]|\\\\.)*"' + ')';
var STRING = '(?:' + SQUOTE_STRING + '|' + DQUOTE_STRING + ')';
var ARGUMENT = '(?:' + IDENT + '|' + NUMBER + '|' + STRING + '\\s*' + ')';
var ARGUMENTS = '(?:' + ARGUMENT + '(?:,\\s*' + ARGUMENT + ')*' + ')';
var ARGUMENT_LIST = '(?:' + '\\(\\s*' + '(?:' + ARGUMENTS + '?' + ')' + '\\)\\s*' + ')';
var BINDING = '(' + IDENT + '\\s*' + ARGUMENT_LIST + '?' + ')';
var OPEN_BRACKET = '(\\[\\[|{{)' + '\\s*';
var CLOSE_BRACKET = '(?:]]|}})';
var NEGATE = '(?:(!)\\s*)?';
var EXPRESSION = OPEN_BRACKET + NEGATE + BINDING + CLOSE_BRACKET;
return new RegExp(EXPRESSION, 'g');
}(),
_parseBindings: function (text) {
var re = this._bindingRegex;
var parts = [];
var lastIndex = 0;
var m;
while ((m = re.exec(text)) !== null) {
if (m.index > lastIndex) {
parts.push({ literal: text.slice(lastIndex, m.index) });
}
var mode = m[1][0];
var negate = Boolean(m[2]);
var value = m[3].trim();
var customEvent, notifyEvent, colon;
if (mode == '{' && (colon = value.indexOf('::')) > 0) {
notifyEvent = value.substring(colon + 2);
value = value.substring(0, colon);
customEvent = true;
}
parts.push({
compoundIndex: parts.length,
value: value,
mode: mode,
negate: negate,
event: notifyEvent,
customEvent: customEvent
});
lastIndex = re.lastIndex;
}
if (lastIndex && lastIndex < text.length) {
var literal = text.substring(lastIndex);
if (literal) {
parts.push({ literal: literal });
}
}
if (parts.length) {
return parts;
}
},
_literalFromParts: function (parts) {
var s = '';
for (var i = 0; i < parts.length; i++) {
var literal = parts[i].literal;
s += literal || '';
}
return s;
},
_parseTextNodeAnnotation: function (node, list) {
var parts = this._parseBindings(node.textContent);
if (parts) {
node.textContent = this._literalFromParts(parts) || ' ';
var annote = {
bindings: [{
kind: 'text',
name: 'textContent',
parts: parts,
isCompound: parts.length !== 1
}]
};
list.push(annote);
return annote;
}
},
_parseElementAnnotations: function (element, list, stripWhiteSpace) {
var annote = {
bindings: [],
events: []
};
if (element.localName === 'content') {
list._hasContent = true;
}
this._parseChildNodesAnnotations(element, annote, list, stripWhiteSpace);
if (element.attributes) {
this._parseNodeAttributeAnnotations(element, annote, list);
if (this.prepElement) {
this.prepElement(element);
}
}
if (annote.bindings.length || annote.events.length || annote.id) {
list.push(annote);
}
return annote;
},
_parseChildNodesAnnotations: function (root, annote, list, stripWhiteSpace) {
if (root.firstChild) {
var node = root.firstChild;
var i = 0;
while (node) {
var next = node.nextSibling;
if (node.localName === 'template' && !node.hasAttribute('preserve-content')) {
this._parseTemplate(node, i, list, annote);
}
if (node.nodeType === Node.TEXT_NODE) {
var n = next;
while (n && n.nodeType === Node.TEXT_NODE) {
node.textContent += n.textContent;
next = n.nextSibling;
root.removeChild(n);
n = next;
}
if (stripWhiteSpace && !node.textContent.trim()) {
root.removeChild(node);
i--;
}
}
if (node.parentNode) {
var childAnnotation = this._parseNodeAnnotations(node, list, stripWhiteSpace);
if (childAnnotation) {
childAnnotation.parent = annote;
childAnnotation.index = i;
}
}
node = next;
i++;
}
}
},
_parseTemplate: function (node, index, list, parent) {
var content = document.createDocumentFragment();
content._notes = this.parseAnnotations(node);
content.appendChild(node.content);
list.push({
bindings: Polymer.nar,
events: Polymer.nar,
templateContent: content,
parent: parent,
index: index
});
},
_parseNodeAttributeAnnotations: function (node, annotation) {
var attrs = Array.prototype.slice.call(node.attributes);
for (var i = attrs.length - 1, a; a = attrs[i]; i--) {
var n = a.name;
var v = a.value;
var b;
if (n.slice(0, 3) === 'on-') {
node.removeAttribute(n);
annotation.events.push({
name: n.slice(3),
value: v
});
} else if (b = this._parseNodeAttributeAnnotation(node, n, v)) {
annotation.bindings.push(b);
} else if (n === 'id') {
annotation.id = v;
}
}
},
_parseNodeAttributeAnnotation: function (node, name, value) {
var parts = this._parseBindings(value);
if (parts) {
var origName = name;
var kind = 'property';
if (name[name.length - 1] == '$') {
name = name.slice(0, -1);
kind = 'attribute';
}
var literal = this._literalFromParts(parts);
if (literal && kind == 'attribute') {
node.setAttribute(name, literal);
}
if (node.localName === 'input' && origName === 'value') {
node.setAttribute(origName, '');
}
node.removeAttribute(origName);
var propertyName = Polymer.CaseMap.dashToCamelCase(name);
if (kind === 'property') {
name = propertyName;
}
return {
kind: kind,
name: name,
propertyName: propertyName,
parts: parts,
literal: literal,
isCompound: parts.length !== 1
};
}
},
findAnnotatedNode: function (root, annote) {
var parent = annote.parent && Polymer.Annotations.findAnnotatedNode(root, annote.parent);
if (parent) {
for (var n = parent.firstChild, i = 0; n; n = n.nextSibling) {
if (annote.index === i++) {
return n;
}
}
} else {
return root;
}
}
};
(function () {
function resolveCss(cssText, ownerDocument) {
return cssText.replace(CSS_URL_RX, function (m, pre, url, post) {
return pre + '\'' + resolve(url.replace(/["']/g, ''), ownerDocument) + '\'' + post;
});
}
function resolveAttrs(element, ownerDocument) {
for (var name in URL_ATTRS) {
var a$ = URL_ATTRS[name];
for (var i = 0, l = a$.length, a, at, v; i < l && (a = a$[i]); i++) {
if (name === '*' || element.localName === name) {
at = element.attributes[a];
v = at && at.value;
if (v && v.search(BINDING_RX) < 0) {
at.value = a === 'style' ? resolveCss(v, ownerDocument) : resolve(v, ownerDocument);
}
}
}
}
}
function resolve(url, ownerDocument) {
if (url && url[0] === '#') {
return url;
}
var resolver = getUrlResolver(ownerDocument);
resolver.href = url;
return resolver.href || url;
}
var tempDoc;
var tempDocBase;
function resolveUrl(url, baseUri) {
if (!tempDoc) {
tempDoc = document.implementation.createHTMLDocument('temp');
tempDocBase = tempDoc.createElement('base');
tempDoc.head.appendChild(tempDocBase);
}
tempDocBase.href = baseUri;
return resolve(url, tempDoc);
}
function getUrlResolver(ownerDocument) {
return ownerDocument.__urlResolver || (ownerDocument.__urlResolver = ownerDocument.createElement('a'));
}
var CSS_URL_RX = /(url\()([^)]*)(\))/g;
var URL_ATTRS = {
'*': [
'href',
'src',
'style',
'url'
],
form: ['action']
};
var BINDING_RX = /\{\{|\[\[/;
Polymer.ResolveUrl = {
resolveCss: resolveCss,
resolveAttrs: resolveAttrs,
resolveUrl: resolveUrl
};
}());
Polymer.Base._addFeature({
_prepAnnotations: function () {
if (!this._template) {
this._notes = [];
} else {
var self = this;
Polymer.Annotations.prepElement = function (element) {
self._prepElement(element);
};
if (this._template._content && this._template._content._notes) {
this._notes = this._template._content._notes;
} else {
this._notes = Polymer.Annotations.parseAnnotations(this._template);
this._processAnnotations(this._notes);
}
Polymer.Annotations.prepElement = null;
}
},
_processAnnotations: function (notes) {
for (var i = 0; i < notes.length; i++) {
var note = notes[i];
for (var j = 0; j < note.bindings.length; j++) {
var b = note.bindings[j];
for (var k = 0; k < b.parts.length; k++) {
var p = b.parts[k];
if (!p.literal) {
var signature = this._parseMethod(p.value);
if (signature) {
p.signature = signature;
} else {
p.model = this._modelForPath(p.value);
}
}
}
}
if (note.templateContent) {
this._processAnnotations(note.templateContent._notes);
var pp = note.templateContent._parentProps = this._discoverTemplateParentProps(note.templateContent._notes);
var bindings = [];
for (var prop in pp) {
var name = '_parent_' + prop;
bindings.push({
index: note.index,
kind: 'property',
name: name,
propertyName: name,
parts: [{
mode: '{',
model: prop,
value: prop
}]
});
}
note.bindings = note.bindings.concat(bindings);
}
}
},
_discoverTemplateParentProps: function (notes) {
var pp = {};
for (var i = 0, n; i < notes.length && (n = notes[i]); i++) {
for (var j = 0, b$ = n.bindings, b; j < b$.length && (b = b$[j]); j++) {
for (var k = 0, p$ = b.parts, p; k < p$.length && (p = p$[k]); k++) {
if (p.signature) {
var args = p.signature.args;
for (var kk = 0; kk < args.length; kk++) {
var model = args[kk].model;
if (model) {
pp[model] = true;
}
}
if (p.signature.dynamicFn) {
pp[p.signature.method] = true;
}
} else {
if (p.model) {
pp[p.model] = true;
}
}
}
}
if (n.templateContent) {
var tpp = n.templateContent._parentProps;
Polymer.Base.mixin(pp, tpp);
}
}
return pp;
},
_prepElement: function (element) {
Polymer.ResolveUrl.resolveAttrs(element, this._template.ownerDocument);
},
_findAnnotatedNode: Polymer.Annotations.findAnnotatedNode,
_marshalAnnotationReferences: function () {
if (this._template) {
this._marshalIdNodes();
this._marshalAnnotatedNodes();
this._marshalAnnotatedListeners();
}
},
_configureAnnotationReferences: function () {
var notes = this._notes;
var nodes = this._nodes;
for (var i = 0; i < notes.length; i++) {
var note = notes[i];
var node = nodes[i];
this._configureTemplateContent(note, node);
this._configureCompoundBindings(note, node);
}
},
_configureTemplateContent: function (note, node) {
if (note.templateContent) {
node._content = note.templateContent;
}
},
_configureCompoundBindings: function (note, node) {
var bindings = note.bindings;
for (var i = 0; i < bindings.length; i++) {
var binding = bindings[i];
if (binding.isCompound) {
var storage = node.__compoundStorage__ || (node.__compoundStorage__ = {});
var parts = binding.parts;
var literals = new Array(parts.length);
for (var j = 0; j < parts.length; j++) {
literals[j] = parts[j].literal;
}
var name = binding.name;
storage[name] = literals;
if (binding.literal && binding.kind == 'property') {
if (node._configValue) {
node._configValue(name, binding.literal);
} else {
node[name] = binding.literal;
}
}
}
}
},
_marshalIdNodes: function () {
this.$ = {};
for (var i = 0, l = this._notes.length, a; i < l && (a = this._notes[i]); i++) {
if (a.id) {
this.$[a.id] = this._findAnnotatedNode(this.root, a);
}
}
},
_marshalAnnotatedNodes: function () {
if (this._notes && this._notes.length) {
var r = new Array(this._notes.length);
for (var i = 0; i < this._notes.length; i++) {
r[i] = this._findAnnotatedNode(this.root, this._notes[i]);
}
this._nodes = r;
}
},
_marshalAnnotatedListeners: function () {
for (var i = 0, l = this._notes.length, a; i < l && (a = this._notes[i]); i++) {
if (a.events && a.events.length) {
var node = this._findAnnotatedNode(this.root, a);
for (var j = 0, e$ = a.events, e; j < e$.length && (e = e$[j]); j++) {
this.listen(node, e.name, e.value);
}
}
}
}
});
Polymer.Base._addFeature({
listeners: {},
_listenListeners: function (listeners) {
var node, name, eventName;
for (eventName in listeners) {
if (eventName.indexOf('.') < 0) {
node = this;
name = eventName;
} else {
name = eventName.split('.');
node = this.$[name[0]];
name = name[1];
}
this.listen(node, name, listeners[eventName]);
}
},
listen: function (node, eventName, methodName) {
var handler = this._recallEventHandler(this, eventName, node, methodName);
if (!handler) {
handler = this._createEventHandler(node, eventName, methodName);
}
if (handler._listening) {
return;
}
this._listen(node, eventName, handler);
handler._listening = true;
},
_boundListenerKey: function (eventName, methodName) {
return eventName + ':' + methodName;
},
_recordEventHandler: function (host, eventName, target, methodName, handler) {
var hbl = host.__boundListeners;
if (!hbl) {
hbl = host.__boundListeners = new WeakMap();
}
var bl = hbl.get(target);
if (!bl) {
bl = {};
hbl.set(target, bl);
}
var key = this._boundListenerKey(eventName, methodName);
bl[key] = handler;
},
_recallEventHandler: function (host, eventName, target, methodName) {
var hbl = host.__boundListeners;
if (!hbl) {
return;
}
var bl = hbl.get(target);
if (!bl) {
return;
}
var key = this._boundListenerKey(eventName, methodName);
return bl[key];
},
_createEventHandler: function (node, eventName, methodName) {
var host = this;
var handler = function (e) {
if (host[methodName]) {
host[methodName](e, e.detail);
} else {
host._warn(host._logf('_createEventHandler', 'listener method `' + methodName + '` not defined'));
}
};
handler._listening = false;
this._recordEventHandler(host, eventName, node, methodName, handler);
return handler;
},
unlisten: function (node, eventName, methodName) {
var handler = this._recallEventHandler(this, eventName, node, methodName);
if (handler) {
this._unlisten(node, eventName, handler);
handler._listening = false;
}
},
_listen: function (node, eventName, handler) {
node.addEventListener(eventName, handler);
},
_unlisten: function (node, eventName, handler) {
node.removeEventListener(eventName, handler);
}
});
(function () {
'use strict';
var wrap = Polymer.DomApi.wrap;
var HAS_NATIVE_TA = typeof document.head.style.touchAction === 'string';
var GESTURE_KEY = '__polymerGestures';
var HANDLED_OBJ = '__polymerGesturesHandled';
var TOUCH_ACTION = '__polymerGesturesTouchAction';
var TAP_DISTANCE = 25;
var TRACK_DISTANCE = 5;
var TRACK_LENGTH = 2;
var MOUSE_TIMEOUT = 2500;
var MOUSE_EVENTS = [
'mousedown',
'mousemove',
'mouseup',
'click'
];
var MOUSE_WHICH_TO_BUTTONS = [
0,
1,
4,
2
];
var MOUSE_HAS_BUTTONS = function () {
try {
return new MouseEvent('test', { buttons: 1 }).buttons === 1;
} catch (e) {
return false;
}
}();
var IS_TOUCH_ONLY = navigator.userAgent.match(/iP(?:[oa]d|hone)|Android/);
var mouseCanceller = function (mouseEvent) {
mouseEvent[HANDLED_OBJ] = { skip: true };
if (mouseEvent.type === 'click') {
var path = Polymer.dom(mouseEvent).path;
for (var i = 0; i < path.length; i++) {
if (path[i] === POINTERSTATE.mouse.target) {
return;
}
}
mouseEvent.preventDefault();
mouseEvent.stopPropagation();
}
};
function setupTeardownMouseCanceller(setup) {
for (var i = 0, en; i < MOUSE_EVENTS.length; i++) {
en = MOUSE_EVENTS[i];
if (setup) {
document.addEventListener(en, mouseCanceller, true);
} else {
document.removeEventListener(en, mouseCanceller, true);
}
}
}
function ignoreMouse() {
if (IS_TOUCH_ONLY) {
return;
}
if (!POINTERSTATE.mouse.mouseIgnoreJob) {
setupTeardownMouseCanceller(true);
}
var unset = function () {
setupTeardownMouseCanceller();
POINTERSTATE.mouse.target = null;
POINTERSTATE.mouse.mouseIgnoreJob = null;
};
POINTERSTATE.mouse.mouseIgnoreJob = Polymer.Debounce(POINTERSTATE.mouse.mouseIgnoreJob, unset, MOUSE_TIMEOUT);
}
function hasLeftMouseButton(ev) {
var type = ev.type;
if (MOUSE_EVENTS.indexOf(type) === -1) {
return false;
}
if (type === 'mousemove') {
var buttons = ev.buttons === undefined ? 1 : ev.buttons;
if (ev instanceof window.MouseEvent && !MOUSE_HAS_BUTTONS) {
buttons = MOUSE_WHICH_TO_BUTTONS[ev.which] || 0;
}
return Boolean(buttons & 1);
} else {
var button = ev.button === undefined ? 0 : ev.button;
return button === 0;
}
}
function isSyntheticClick(ev) {
if (ev.type === 'click') {
if (ev.detail === 0) {
return true;
}
var t = Gestures.findOriginalTarget(ev);
var bcr = t.getBoundingClientRect();
var x = ev.pageX, y = ev.pageY;
return !(x >= bcr.left && x <= bcr.right && (y >= bcr.top && y <= bcr.bottom));
}
return false;
}
var POINTERSTATE = {
mouse: {
target: null,
mouseIgnoreJob: null
},
touch: {
x: 0,
y: 0,
id: -1,
scrollDecided: false
}
};
function firstTouchAction(ev) {
var path = Polymer.dom(ev).path;
var ta = 'auto';
for (var i = 0, n; i < path.length; i++) {
n = path[i];
if (n[TOUCH_ACTION]) {
ta = n[TOUCH_ACTION];
break;
}
}
return ta;
}
function trackDocument(stateObj, movefn, upfn) {
stateObj.movefn = movefn;
stateObj.upfn = upfn;
document.addEventListener('mousemove', movefn);
document.addEventListener('mouseup', upfn);
}
function untrackDocument(stateObj) {
document.removeEventListener('mousemove', stateObj.movefn);
document.removeEventListener('mouseup', stateObj.upfn);
stateObj.movefn = null;
stateObj.upfn = null;
}
var Gestures = {
gestures: {},
recognizers: [],
deepTargetFind: function (x, y) {
var node = document.elementFromPoint(x, y);
var next = node;
while (next && next.shadowRoot) {
next = next.shadowRoot.elementFromPoint(x, y);
if (next) {
node = next;
}
}
return node;
},
findOriginalTarget: function (ev) {
if (ev.path) {
return ev.path[0];
}
return ev.target;
},
handleNative: function (ev) {
var handled;
var type = ev.type;
var node = wrap(ev.currentTarget);
var gobj = node[GESTURE_KEY];
if (!gobj) {
return;
}
var gs = gobj[type];
if (!gs) {
return;
}
if (!ev[HANDLED_OBJ]) {
ev[HANDLED_OBJ] = {};
if (type.slice(0, 5) === 'touch') {
var t = ev.changedTouches[0];
if (type === 'touchstart') {
if (ev.touches.length === 1) {
POINTERSTATE.touch.id = t.identifier;
}
}
if (POINTERSTATE.touch.id !== t.identifier) {
return;
}
if (!HAS_NATIVE_TA) {
if (type === 'touchstart' || type === 'touchmove') {
Gestures.handleTouchAction(ev);
}
}
if (type === 'touchend') {
POINTERSTATE.mouse.target = Polymer.dom(ev).rootTarget;
ignoreMouse();
}
}
}
handled = ev[HANDLED_OBJ];
if (handled.skip) {
return;
}
var recognizers = Gestures.recognizers;
for (var i = 0, r; i < recognizers.length; i++) {
r = recognizers[i];
if (gs[r.name] && !handled[r.name]) {
if (r.flow && r.flow.start.indexOf(ev.type) > -1 && r.reset) {
r.reset();
}
}
}
for (i = 0, r; i < recognizers.length; i++) {
r = recognizers[i];
if (gs[r.name] && !handled[r.name]) {
handled[r.name] = true;
r[type](ev);
}
}
},
handleTouchAction: function (ev) {
var t = ev.changedTouches[0];
var type = ev.type;
if (type === 'touchstart') {
POINTERSTATE.touch.x = t.clientX;
POINTERSTATE.touch.y = t.clientY;
POINTERSTATE.touch.scrollDecided = false;
} else if (type === 'touchmove') {
if (POINTERSTATE.touch.scrollDecided) {
return;
}
POINTERSTATE.touch.scrollDecided = true;
var ta = firstTouchAction(ev);
var prevent = false;
var dx = Math.abs(POINTERSTATE.touch.x - t.clientX);
var dy = Math.abs(POINTERSTATE.touch.y - t.clientY);
if (!ev.cancelable) {
} else if (ta === 'none') {
prevent = true;
} else if (ta === 'pan-x') {
prevent = dy > dx;
} else if (ta === 'pan-y') {
prevent = dx > dy;
}
if (prevent) {
ev.preventDefault();
} else {
Gestures.prevent('track');
}
}
},
add: function (node, evType, handler) {
node = wrap(node);
var recognizer = this.gestures[evType];
var deps = recognizer.deps;
var name = recognizer.name;
var gobj = node[GESTURE_KEY];
if (!gobj) {
node[GESTURE_KEY] = gobj = {};
}
for (var i = 0, dep, gd; i < deps.length; i++) {
dep = deps[i];
if (IS_TOUCH_ONLY && MOUSE_EVENTS.indexOf(dep) > -1) {
continue;
}
gd = gobj[dep];
if (!gd) {
gobj[dep] = gd = { _count: 0 };
}
if (gd._count === 0) {
node.addEventListener(dep, this.handleNative);
}
gd[name] = (gd[name] || 0) + 1;
gd._count = (gd._count || 0) + 1;
}
node.addEventListener(evType, handler);
if (recognizer.touchAction) {
this.setTouchAction(node, recognizer.touchAction);
}
},
remove: function (node, evType, handler) {
node = wrap(node);
var recognizer = this.gestures[evType];
var deps = recognizer.deps;
var name = recognizer.name;
var gobj = node[GESTURE_KEY];
if (gobj) {
for (var i = 0, dep, gd; i < deps.length; i++) {
dep = deps[i];
gd = gobj[dep];
if (gd && gd[name]) {
gd[name] = (gd[name] || 1) - 1;
gd._count = (gd._count || 1) - 1;
if (gd._count === 0) {
node.removeEventListener(dep, this.handleNative);
}
}
}
}
node.removeEventListener(evType, handler);
},
register: function (recog) {
this.recognizers.push(recog);
for (var i = 0; i < recog.emits.length; i++) {
this.gestures[recog.emits[i]] = recog;
}
},
findRecognizerByEvent: function (evName) {
for (var i = 0, r; i < this.recognizers.length; i++) {
r = this.recognizers[i];
for (var j = 0, n; j < r.emits.length; j++) {
n = r.emits[j];
if (n === evName) {
return r;
}
}
}
return null;
},
setTouchAction: function (node, value) {
if (HAS_NATIVE_TA) {
node.style.touchAction = value;
}
node[TOUCH_ACTION] = value;
},
fire: function (target, type, detail) {
var ev = Polymer.Base.fire(type, detail, {
node: target,
bubbles: true,
cancelable: true
});
if (ev.defaultPrevented) {
var se = detail.sourceEvent;
if (se && se.preventDefault) {
se.preventDefault();
}
}
},
prevent: function (evName) {
var recognizer = this.findRecognizerByEvent(evName);
if (recognizer.info) {
recognizer.info.prevent = true;
}
},
resetMouseCanceller: function () {
if (POINTERSTATE.mouse.mouseIgnoreJob) {
POINTERSTATE.mouse.mouseIgnoreJob.complete();
}
}
};
Gestures.register({
name: 'downup',
deps: [
'mousedown',
'touchstart',
'touchend'
],
flow: {
start: [
'mousedown',
'touchstart'
],
end: [
'mouseup',
'touchend'
]
},
emits: [
'down',
'up'
],
info: {
movefn: null,
upfn: null
},
reset: function () {
untrackDocument(this.info);
},
mousedown: function (e) {
if (!hasLeftMouseButton(e)) {
return;
}
var t = Gestures.findOriginalTarget(e);
var self = this;
var movefn = function movefn(e) {
if (!hasLeftMouseButton(e)) {
self.fire('up', t, e);
untrackDocument(self.info);
}
};
var upfn = function upfn(e) {
if (hasLeftMouseButton(e)) {
self.fire('up', t, e);
}
untrackDocument(self.info);
};
trackDocument(this.info, movefn, upfn);
this.fire('down', t, e);
},
touchstart: function (e) {
this.fire('down', Gestures.findOriginalTarget(e), e.changedTouches[0]);
},
touchend: function (e) {
this.fire('up', Gestures.findOriginalTarget(e), e.changedTouches[0]);
},
fire: function (type, target, event) {
Gestures.fire(target, type, {
x: event.clientX,
y: event.clientY,
sourceEvent: event,
prevent: function (e) {
return Gestures.prevent(e);
}
});
}
});
Gestures.register({
name: 'track',
touchAction: 'none',
deps: [
'mousedown',
'touchstart',
'touchmove',
'touchend'
],
flow: {
start: [
'mousedown',
'touchstart'
],
end: [
'mouseup',
'touchend'
]
},
emits: ['track'],
info: {
x: 0,
y: 0,
state: 'start',
started: false,
moves: [],
addMove: function (move) {
if (this.moves.length > TRACK_LENGTH) {
this.moves.shift();
}
this.moves.push(move);
},
movefn: null,
upfn: null,
prevent: false
},
reset: function () {
this.info.state = 'start';
this.info.started = false;
this.info.moves = [];
this.info.x = 0;
this.info.y = 0;
this.info.prevent = false;
untrackDocument(this.info);
},
hasMovedEnough: function (x, y) {
if (this.info.prevent) {
return false;
}
if (this.info.started) {
return true;
}
var dx = Math.abs(this.info.x - x);
var dy = Math.abs(this.info.y - y);
return dx >= TRACK_DISTANCE || dy >= TRACK_DISTANCE;
},
mousedown: function (e) {
if (!hasLeftMouseButton(e)) {
return;
}
var t = Gestures.findOriginalTarget(e);
var self = this;
var movefn = function movefn(e) {
var x = e.clientX, y = e.clientY;
if (self.hasMovedEnough(x, y)) {
self.info.state = self.info.started ? e.type === 'mouseup' ? 'end' : 'track' : 'start';
if (self.info.state === 'start') {
Gestures.prevent('tap');
}
self.info.addMove({
x: x,
y: y
});
if (!hasLeftMouseButton(e)) {
self.info.state = 'end';
untrackDocument(self.info);
}
self.fire(t, e);
self.info.started = true;
}
};
var upfn = function upfn(e) {
if (self.info.started) {
movefn(e);
}
untrackDocument(self.info);
};
trackDocument(this.info, movefn, upfn);
this.info.x = e.clientX;
this.info.y = e.clientY;
},
touchstart: function (e) {
var ct = e.changedTouches[0];
this.info.x = ct.clientX;
this.info.y = ct.clientY;
},
touchmove: function (e) {
var t = Gestures.findOriginalTarget(e);
var ct = e.changedTouches[0];
var x = ct.clientX, y = ct.clientY;
if (this.hasMovedEnough(x, y)) {
if (this.info.state === 'start') {
Gestures.prevent('tap');
}
this.info.addMove({
x: x,
y: y
});
this.fire(t, ct);
this.info.state = 'track';
this.info.started = true;
}
},
touchend: function (e) {
var t = Gestures.findOriginalTarget(e);
var ct = e.changedTouches[0];
if (this.info.started) {
this.info.state = 'end';
this.info.addMove({
x: ct.clientX,
y: ct.clientY
});
this.fire(t, ct);
}
},
fire: function (target, touch) {
var secondlast = this.info.moves[this.info.moves.length - 2];
var lastmove = this.info.moves[this.info.moves.length - 1];
var dx = lastmove.x - this.info.x;
var dy = lastmove.y - this.info.y;
var ddx, ddy = 0;
if (secondlast) {
ddx = lastmove.x - secondlast.x;
ddy = lastmove.y - secondlast.y;
}
return Gestures.fire(target, 'track', {
state: this.info.state,
x: touch.clientX,
y: touch.clientY,
dx: dx,
dy: dy,
ddx: ddx,
ddy: ddy,
sourceEvent: touch,
hover: function () {
return Gestures.deepTargetFind(touch.clientX, touch.clientY);
}
});
}
});
Gestures.register({
name: 'tap',
deps: [
'mousedown',
'click',
'touchstart',
'touchend'
],
flow: {
start: [
'mousedown',
'touchstart'
],
end: [
'click',
'touchend'
]
},
emits: ['tap'],
info: {
x: NaN,
y: NaN,
prevent: false
},
reset: function () {
this.info.x = NaN;
this.info.y = NaN;
this.info.prevent = false;
},
save: function (e) {
this.info.x = e.clientX;
this.info.y = e.clientY;
},
mousedown: function (e) {
if (hasLeftMouseButton(e)) {
this.save(e);
}
},
click: function (e) {
if (hasLeftMouseButton(e)) {
this.forward(e);
}
},
touchstart: function (e) {
this.save(e.changedTouches[0]);
},
touchend: function (e) {
this.forward(e.changedTouches[0]);
},
forward: function (e) {
var dx = Math.abs(e.clientX - this.info.x);
var dy = Math.abs(e.clientY - this.info.y);
var t = Gestures.findOriginalTarget(e);
if (isNaN(dx) || isNaN(dy) || dx <= TAP_DISTANCE && dy <= TAP_DISTANCE || isSyntheticClick(e)) {
if (!this.info.prevent) {
Gestures.fire(t, 'tap', {
x: e.clientX,
y: e.clientY,
sourceEvent: e
});
}
}
}
});
var DIRECTION_MAP = {
x: 'pan-x',
y: 'pan-y',
none: 'none',
all: 'auto'
};
Polymer.Base._addFeature({
_setupGestures: function () {
this.__polymerGestures = null;
},
_listen: function (node, eventName, handler) {
if (Gestures.gestures[eventName]) {
Gestures.add(node, eventName, handler);
} else {
node.addEventListener(eventName, handler);
}
},
_unlisten: function (node, eventName, handler) {
if (Gestures.gestures[eventName]) {
Gestures.remove(node, eventName, handler);
} else {
node.removeEventListener(eventName, handler);
}
},
setScrollDirection: function (direction, node) {
node = node || this;
Gestures.setTouchAction(node, DIRECTION_MAP[direction] || 'auto');
}
});
Polymer.Gestures = Gestures;
}());
Polymer.Base._addFeature({
$$: function (slctr) {
return Polymer.dom(this.root).querySelector(slctr);
},
toggleClass: function (name, bool, node) {
node = node || this;
if (arguments.length == 1) {
bool = !node.classList.contains(name);
}
if (bool) {
Polymer.dom(node).classList.add(name);
} else {
Polymer.dom(node).classList.remove(name);
}
},
toggleAttribute: function (name, bool, node) {
node = node || this;
if (arguments.length == 1) {
bool = !node.hasAttribute(name);
}
if (bool) {
Polymer.dom(node).setAttribute(name, '');
} else {
Polymer.dom(node).removeAttribute(name);
}
},
classFollows: function (name, toElement, fromElement) {
if (fromElement) {
Polymer.dom(fromElement).classList.remove(name);
}
if (toElement) {
Polymer.dom(toElement).classList.add(name);
}
},
attributeFollows: function (name, toElement, fromElement) {
if (fromElement) {
Polymer.dom(fromElement).removeAttribute(name);
}
if (toElement) {
Polymer.dom(toElement).setAttribute(name, '');
}
},
getEffectiveChildNodes: function () {
return Polymer.dom(this).getEffectiveChildNodes();
},
getEffectiveChildren: function () {
var list = Polymer.dom(this).getEffectiveChildNodes();
return list.filter(function (n) {
return n.nodeType === Node.ELEMENT_NODE;
});
},
getEffectiveTextContent: function () {
var cn = this.getEffectiveChildNodes();
var tc = [];
for (var i = 0, c; c = cn[i]; i++) {
if (c.nodeType !== Node.COMMENT_NODE) {
tc.push(Polymer.dom(c).textContent);
}
}
return tc.join('');
},
queryEffectiveChildren: function (slctr) {
var e$ = Polymer.dom(this).queryDistributedElements(slctr);
return e$ && e$[0];
},
queryAllEffectiveChildren: function (slctr) {
return Polymer.dom(this).queryDistributedElements(slctr);
},
getContentChildNodes: function (slctr) {
var content = Polymer.dom(this.root).querySelector(slctr || 'content');
return content ? Polymer.dom(content).getDistributedNodes() : [];
},
getContentChildren: function (slctr) {
return this.getContentChildNodes(slctr).filter(function (n) {
return n.nodeType === Node.ELEMENT_NODE;
});
},
fire: function (type, detail, options) {
options = options || Polymer.nob;
var node = options.node || this;
detail = detail === null || detail === undefined ? {} : detail;
var bubbles = options.bubbles === undefined ? true : options.bubbles;
var cancelable = Boolean(options.cancelable);
var useCache = options._useCache;
var event = this._getEvent(type, bubbles, cancelable, useCache);
event.detail = detail;
if (useCache) {
this.__eventCache[type] = null;
}
node.dispatchEvent(event);
if (useCache) {
this.__eventCache[type] = event;
}
return event;
},
__eventCache: {},
_getEvent: function (type, bubbles, cancelable, useCache) {
var event = useCache && this.__eventCache[type];
if (!event || (event.bubbles != bubbles || event.cancelable != cancelable)) {
event = new Event(type, {
bubbles: Boolean(bubbles),
cancelable: cancelable
});
}
return event;
},
async: function (callback, waitTime) {
var self = this;
return Polymer.Async.run(function () {
callback.call(self);
}, waitTime);
},
cancelAsync: function (handle) {
Polymer.Async.cancel(handle);
},
arrayDelete: function (path, item) {
var index;
if (Array.isArray(path)) {
index = path.indexOf(item);
if (index >= 0) {
return path.splice(index, 1);
}
} else {
var arr = this._get(path);
index = arr.indexOf(item);
if (index >= 0) {
return this.splice(path, index, 1);
}
}
},
transform: function (transform, node) {
node = node || this;
node.style.webkitTransform = transform;
node.style.transform = transform;
},
translate3d: function (x, y, z, node) {
node = node || this;
this.transform('translate3d(' + x + ',' + y + ',' + z + ')', node);
},
importHref: function (href, onload, onerror, optAsync) {
var l = document.createElement('link');
l.rel = 'import';
l.href = href;
optAsync = Boolean(optAsync);
if (optAsync) {
l.setAttribute('async', '');
}
var self = this;
if (onload) {
l.onload = function (e) {
return onload.call(self, e);
};
}
if (onerror) {
l.onerror = function (e) {
return onerror.call(self, e);
};
}
document.head.appendChild(l);
return l;
},
create: function (tag, props) {
var elt = document.createElement(tag);
if (props) {
for (var n in props) {
elt[n] = props[n];
}
}
return elt;
},
isLightDescendant: function (node) {
return this !== node && this.contains(node) && Polymer.dom(this).getOwnerRoot() === Polymer.dom(node).getOwnerRoot();
},
isLocalDescendant: function (node) {
return this.root === Polymer.dom(node).getOwnerRoot();
}
});
Polymer.Bind = {
prepareModel: function (model) {
Polymer.Base.mixin(model, this._modelApi);
},
_modelApi: {
_notifyChange: function (source, event, value) {
value = value === undefined ? this[source] : value;
event = event || Polymer.CaseMap.camelToDashCase(source) + '-changed';
this.fire(event, { value: value }, {
bubbles: false,
cancelable: false,
_useCache: true
});
},
_propertySetter: function (property, value, effects, fromAbove) {
var old = this.__data__[property];
if (old !== value && (old === old || value === value)) {
this.__data__[property] = value;
if (typeof value == 'object') {
this._clearPath(property);
}
if (this._propertyChanged) {
this._propertyChanged(property, value, old);
}
if (effects) {
this._effectEffects(property, value, effects, old, fromAbove);
}
}
return old;
},
__setProperty: function (property, value, quiet, node) {
node = node || this;
var effects = node._propertyEffects && node._propertyEffects[property];
if (effects) {
node._propertySetter(property, value, effects, quiet);
} else {
node[property] = value;
}
},
_effectEffects: function (property, value, effects, old, fromAbove) {
for (var i = 0, l = effects.length, fx; i < l && (fx = effects[i]); i++) {
fx.fn.call(this, property, value, fx.effect, old, fromAbove);
}
},
_clearPath: function (path) {
for (var prop in this.__data__) {
if (prop.indexOf(path + '.') === 0) {
this.__data__[prop] = undefined;
}
}
}
},
ensurePropertyEffects: function (model, property) {
if (!model._propertyEffects) {
model._propertyEffects = {};
}
var fx = model._propertyEffects[property];
if (!fx) {
fx = model._propertyEffects[property] = [];
}
return fx;
},
addPropertyEffect: function (model, property, kind, effect) {
var fx = this.ensurePropertyEffects(model, property);
var propEffect = {
kind: kind,
effect: effect,
fn: Polymer.Bind['_' + kind + 'Effect']
};
fx.push(propEffect);
return propEffect;
},
createBindings: function (model) {
var fx$ = model._propertyEffects;
if (fx$) {
for (var n in fx$) {
var fx = fx$[n];
fx.sort(this._sortPropertyEffects);
this._createAccessors(model, n, fx);
}
}
},
_sortPropertyEffects: function () {
var EFFECT_ORDER = {
'compute': 0,
'annotation': 1,
'annotatedComputation': 2,
'reflect': 3,
'notify': 4,
'observer': 5,
'complexObserver': 6,
'function': 7
};
return function (a, b) {
return EFFECT_ORDER[a.kind] - EFFECT_ORDER[b.kind];
};
}(),
_createAccessors: function (model, property, effects) {
var defun = {
get: function () {
return this.__data__[property];
}
};
var setter = function (value) {
this._propertySetter(property, value, effects);
};
var info = model.getPropertyInfo && model.getPropertyInfo(property);
if (info && info.readOnly) {
if (!info.computed) {
model['_set' + this.upper(property)] = setter;
}
} else {
defun.set = setter;
}
Object.defineProperty(model, property, defun);
},
upper: function (name) {
return name[0].toUpperCase() + name.substring(1);
},
_addAnnotatedListener: function (model, index, property, path, event, negated) {
if (!model._bindListeners) {
model._bindListeners = [];
}
var fn = this._notedListenerFactory(property, path, this._isStructured(path), negated);
var eventName = event || Polymer.CaseMap.camelToDashCase(property) + '-changed';
model._bindListeners.push({
index: index,
property: property,
path: path,
changedFn: fn,
event: eventName
});
},
_isStructured: function (path) {
return path.indexOf('.') > 0;
},
_isEventBogus: function (e, target) {
return e.path && e.path[0] !== target;
},
_notedListenerFactory: function (property, path, isStructured, negated) {
return function (target, value, targetPath) {
if (targetPath) {
this._notifyPath(this._fixPath(path, property, targetPath), value);
} else {
value = target[property];
if (negated) {
value = !value;
}
if (!isStructured) {
this[path] = value;
} else {
if (this.__data__[path] != value) {
this.set(path, value);
}
}
}
};
},
prepareInstance: function (inst) {
inst.__data__ = Object.create(null);
},
setupBindListeners: function (inst) {
var b$ = inst._bindListeners;
for (var i = 0, l = b$.length, info; i < l && (info = b$[i]); i++) {
var node = inst._nodes[info.index];
this._addNotifyListener(node, inst, info.event, info.changedFn);
}
},
_addNotifyListener: function (element, context, event, changedFn) {
element.addEventListener(event, function (e) {
return context._notifyListener(changedFn, e);
});
}
};
Polymer.Base.extend(Polymer.Bind, {
_shouldAddListener: function (effect) {
return effect.name && effect.kind != 'attribute' && effect.kind != 'text' && !effect.isCompound && effect.parts[0].mode === '{';
},
_annotationEffect: function (source, value, effect) {
if (source != effect.value) {
value = this._get(effect.value);
this.__data__[effect.value] = value;
}
this._applyEffectValue(effect, value);
},
_reflectEffect: function (source, value, effect) {
this.reflectPropertyToAttribute(source, effect.attribute, value);
},
_notifyEffect: function (source, value, effect, old, fromAbove) {
if (!fromAbove) {
this._notifyChange(source, effect.event, value);
}
},
_functionEffect: function (source, value, fn, old, fromAbove) {
fn.call(this, source, value, old, fromAbove);
},
_observerEffect: function (source, value, effect, old) {
var fn = this[effect.method];
if (fn) {
fn.call(this, value, old);
} else {
this._warn(this._logf('_observerEffect', 'observer method `' + effect.method + '` not defined'));
}
},
_complexObserverEffect: function (source, value, effect) {
var fn = this[effect.method];
if (fn) {
var args = Polymer.Bind._marshalArgs(this.__data__, effect, source, value);
if (args) {
fn.apply(this, args);
}
} else if (effect.dynamicFn) {
} else {
this._warn(this._logf('_complexObserverEffect', 'observer method `' + effect.method + '` not defined'));
}
},
_computeEffect: function (source, value, effect) {
var fn = this[effect.method];
if (fn) {
var args = Polymer.Bind._marshalArgs(this.__data__, effect, source, value);
if (args) {
var computedvalue = fn.apply(this, args);
this.__setProperty(effect.name, computedvalue);
}
} else if (effect.dynamicFn) {
} else {
this._warn(this._logf('_computeEffect', 'compute method `' + effect.method + '` not defined'));
}
},
_annotatedComputationEffect: function (source, value, effect) {
var computedHost = this._rootDataHost || this;
var fn = computedHost[effect.method];
if (fn) {
var args = Polymer.Bind._marshalArgs(this.__data__, effect, source, value);
if (args) {
var computedvalue = fn.apply(computedHost, args);
this._applyEffectValue(effect, computedvalue);
}
} else if (effect.dynamicFn) {
} else {
computedHost._warn(computedHost._logf('_annotatedComputationEffect', 'compute method `' + effect.method + '` not defined'));
}
},
_marshalArgs: function (model, effect, path, value) {
var values = [];
var args = effect.args;
var bailoutEarly = args.length > 1 || effect.dynamicFn;
for (var i = 0, l = args.length; i < l; i++) {
var arg = args[i];
var name = arg.name;
var v;
if (arg.literal) {
v = arg.value;
} else if (path === name) {
v = value;
} else {
v = model[name];
if (v === undefined && arg.structured) {
v = Polymer.Base._get(name, model);
}
}
if (bailoutEarly && v === undefined) {
return;
}
if (arg.wildcard) {
var matches = path.indexOf(name + '.') === 0;
values[i] = {
path: matches ? path : name,
value: matches ? value : v,
base: v
};
} else {
values[i] = v;
}
}
return values;
}
});
Polymer.Base._addFeature({
_addPropertyEffect: function (property, kind, effect) {
var prop = Polymer.Bind.addPropertyEffect(this, property, kind, effect);
prop.pathFn = this['_' + prop.kind + 'PathEffect'];
},
_prepEffects: function () {
Polymer.Bind.prepareModel(this);
this._addAnnotationEffects(this._notes);
},
_prepBindings: function () {
Polymer.Bind.createBindings(this);
},
_addPropertyEffects: function (properties) {
if (properties) {
for (var p in properties) {
var prop = properties[p];
if (prop.observer) {
this._addObserverEffect(p, prop.observer);
}
if (prop.computed) {
prop.readOnly = true;
this._addComputedEffect(p, prop.computed);
}
if (prop.notify) {
this._addPropertyEffect(p, 'notify', { event: Polymer.CaseMap.camelToDashCase(p) + '-changed' });
}
if (prop.reflectToAttribute) {
var attr = Polymer.CaseMap.camelToDashCase(p);
if (attr[0] === '-') {
this._warn(this._logf('_addPropertyEffects', 'Property ' + p + ' cannot be reflected to attribute ' + attr + ' because "-" is not a valid starting attribute name. Use a lowercase first letter for the property instead.'));
} else {
this._addPropertyEffect(p, 'reflect', { attribute: attr });
}
}
if (prop.readOnly) {
Polymer.Bind.ensurePropertyEffects(this, p);
}
}
}
},
_addComputedEffect: function (name, expression) {
var sig = this._parseMethod(expression);
var dynamicFn = sig.dynamicFn;
for (var i = 0, arg; i < sig.args.length && (arg = sig.args[i]); i++) {
this._addPropertyEffect(arg.model, 'compute', {
method: sig.method,
args: sig.args,
trigger: arg,
name: name,
dynamicFn: dynamicFn
});
}
if (dynamicFn) {
this._addPropertyEffect(sig.method, 'compute', {
method: sig.method,
args: sig.args,
trigger: null,
name: name,
dynamicFn: dynamicFn
});
}
},
_addObserverEffect: function (property, observer) {
this._addPropertyEffect(property, 'observer', {
method: observer,
property: property
});
},
_addComplexObserverEffects: function (observers) {
if (observers) {
for (var i = 0, o; i < observers.length && (o = observers[i]); i++) {
this._addComplexObserverEffect(o);
}
}
},
_addComplexObserverEffect: function (observer) {
var sig = this._parseMethod(observer);
if (!sig) {
throw new Error('Malformed observer expression \'' + observer + '\'');
}
var dynamicFn = sig.dynamicFn;
for (var i = 0, arg; i < sig.args.length && (arg = sig.args[i]); i++) {
this._addPropertyEffect(arg.model, 'complexObserver', {
method: sig.method,
args: sig.args,
trigger: arg,
dynamicFn: dynamicFn
});
}
if (dynamicFn) {
this._addPropertyEffect(sig.method, 'complexObserver', {
method: sig.method,
args: sig.args,
trigger: null,
dynamicFn: dynamicFn
});
}
},
_addAnnotationEffects: function (notes) {
for (var i = 0, note; i < notes.length && (note = notes[i]); i++) {
var b$ = note.bindings;
for (var j = 0, binding; j < b$.length && (binding = b$[j]); j++) {
this._addAnnotationEffect(binding, i);
}
}
},
_addAnnotationEffect: function (note, index) {
if (Polymer.Bind._shouldAddListener(note)) {
Polymer.Bind._addAnnotatedListener(this, index, note.name, note.parts[0].value, note.parts[0].event, note.parts[0].negate);
}
for (var i = 0; i < note.parts.length; i++) {
var part = note.parts[i];
if (part.signature) {
this._addAnnotatedComputationEffect(note, part, index);
} else if (!part.literal) {
if (note.kind === 'attribute' && note.name[0] === '-') {
this._warn(this._logf('_addAnnotationEffect', 'Cannot set attribute ' + note.name + ' because "-" is not a valid attribute starting character'));
} else {
this._addPropertyEffect(part.model, 'annotation', {
kind: note.kind,
index: index,
name: note.name,
propertyName: note.propertyName,
value: part.value,
isCompound: note.isCompound,
compoundIndex: part.compoundIndex,
event: part.event,
customEvent: part.customEvent,
negate: part.negate
});
}
}
}
},
_addAnnotatedComputationEffect: function (note, part, index) {
var sig = part.signature;
if (sig.static) {
this.__addAnnotatedComputationEffect('__static__', index, note, part, null);
} else {
for (var i = 0, arg; i < sig.args.length && (arg = sig.args[i]); i++) {
if (!arg.literal) {
this.__addAnnotatedComputationEffect(arg.model, index, note, part, arg);
}
}
if (sig.dynamicFn) {
this.__addAnnotatedComputationEffect(sig.method, index, note, part, null);
}
}
},
__addAnnotatedComputationEffect: function (property, index, note, part, trigger) {
this._addPropertyEffect(property, 'annotatedComputation', {
index: index,
isCompound: note.isCompound,
compoundIndex: part.compoundIndex,
kind: note.kind,
name: note.name,
negate: part.negate,
method: part.signature.method,
args: part.signature.args,
trigger: trigger,
dynamicFn: part.signature.dynamicFn
});
},
_parseMethod: function (expression) {
var m = expression.match(/([^\s]+?)\(([\s\S]*)\)/);
if (m) {
var sig = {
method: m[1],
static: true
};
if (this.getPropertyInfo(sig.method) !== Polymer.nob) {
sig.static = false;
sig.dynamicFn = true;
}
if (m[2].trim()) {
var args = m[2].replace(/\\,/g, '&comma;').split(',');
return this._parseArgs(args, sig);
} else {
sig.args = Polymer.nar;
return sig;
}
}
},
_parseArgs: function (argList, sig) {
sig.args = argList.map(function (rawArg) {
var arg = this._parseArg(rawArg);
if (!arg.literal) {
sig.static = false;
}
return arg;
}, this);
return sig;
},
_parseArg: function (rawArg) {
var arg = rawArg.trim().replace(/&comma;/g, ',').replace(/\\(.)/g, '$1');
var a = { name: arg };
var fc = arg[0];
if (fc === '-') {
fc = arg[1];
}
if (fc >= '0' && fc <= '9') {
fc = '#';
}
switch (fc) {
case '\'':
case '"':
a.value = arg.slice(1, -1);
a.literal = true;
break;
case '#':
a.value = Number(arg);
a.literal = true;
break;
}
if (!a.literal) {
a.model = this._modelForPath(arg);
a.structured = arg.indexOf('.') > 0;
if (a.structured) {
a.wildcard = arg.slice(-2) == '.*';
if (a.wildcard) {
a.name = arg.slice(0, -2);
}
}
}
return a;
},
_marshalInstanceEffects: function () {
Polymer.Bind.prepareInstance(this);
if (this._bindListeners) {
Polymer.Bind.setupBindListeners(this);
}
},
_applyEffectValue: function (info, value) {
var node = this._nodes[info.index];
var property = info.name;
value = this._computeFinalAnnotationValue(node, property, value, info);
if (info.customEvent && node[property] === value) {
return;
}
if (info.kind == 'attribute') {
this.serializeValueToAttribute(value, property, node);
} else {
var pinfo = node._propertyInfo && node._propertyInfo[property];
if (pinfo && pinfo.readOnly) {
return;
}
this.__setProperty(property, value, false, node);
}
},
_computeFinalAnnotationValue: function (node, property, value, info) {
if (info.negate) {
value = !value;
}
if (info.isCompound) {
var storage = node.__compoundStorage__[property];
storage[info.compoundIndex] = value;
value = storage.join('');
}
if (info.kind !== 'attribute') {
if (property === 'className') {
value = this._scopeElementClass(node, value);
}
if (property === 'textContent' || node.localName == 'input' && property == 'value') {
value = value == undefined ? '' : value;
}
}
return value;
},
_executeStaticEffects: function () {
if (this._propertyEffects && this._propertyEffects.__static__) {
this._effectEffects('__static__', null, this._propertyEffects.__static__);
}
}
});
(function () {
var usePolyfillProto = Polymer.Settings.usePolyfillProto;
Polymer.Base._addFeature({
_setupConfigure: function (initialConfig) {
this._config = {};
this._handlers = [];
this._aboveConfig = null;
if (initialConfig) {
for (var i in initialConfig) {
if (initialConfig[i] !== undefined) {
this._config[i] = initialConfig[i];
}
}
}
},
_marshalAttributes: function () {
this._takeAttributesToModel(this._config);
},
_attributeChangedImpl: function (name) {
var model = this._clientsReadied ? this : this._config;
this._setAttributeToProperty(model, name);
},
_configValue: function (name, value) {
var info = this._propertyInfo[name];
if (!info || !info.readOnly) {
this._config[name] = value;
}
},
_beforeClientsReady: function () {
this._configure();
},
_configure: function () {
this._configureAnnotationReferences();
this._aboveConfig = this.mixin({}, this._config);
var config = {};
for (var i = 0; i < this.behaviors.length; i++) {
this._configureProperties(this.behaviors[i].properties, config);
}
this._configureProperties(this.properties, config);
this.mixin(config, this._aboveConfig);
this._config = config;
if (this._clients && this._clients.length) {
this._distributeConfig(this._config);
}
},
_configureProperties: function (properties, config) {
for (var i in properties) {
var c = properties[i];
if (!usePolyfillProto && this.hasOwnProperty(i) && this._propertyEffects && this._propertyEffects[i]) {
config[i] = this[i];
delete this[i];
} else if (c.value !== undefined) {
var value = c.value;
if (typeof value == 'function') {
value = value.call(this, this._config);
}
config[i] = value;
}
}
},
_distributeConfig: function (config) {
var fx$ = this._propertyEffects;
if (fx$) {
for (var p in config) {
var fx = fx$[p];
if (fx) {
for (var i = 0, l = fx.length, x; i < l && (x = fx[i]); i++) {
if (x.kind === 'annotation') {
var node = this._nodes[x.effect.index];
var name = x.effect.propertyName;
var isAttr = x.effect.kind == 'attribute';
var hasEffect = node._propertyEffects && node._propertyEffects[name];
if (node._configValue && (hasEffect || !isAttr)) {
var value = p === x.effect.value ? config[p] : this._get(x.effect.value, config);
value = this._computeFinalAnnotationValue(node, name, value, x.effect);
if (isAttr) {
value = node.deserialize(this.serialize(value), node._propertyInfo[name].type);
}
node._configValue(name, value);
}
}
}
}
}
}
},
_afterClientsReady: function () {
this._executeStaticEffects();
this._applyConfig(this._config, this._aboveConfig);
this._flushHandlers();
},
_applyConfig: function (config, aboveConfig) {
for (var n in config) {
if (this[n] === undefined) {
this.__setProperty(n, config[n], n in aboveConfig);
}
}
},
_notifyListener: function (fn, e) {
if (!Polymer.Bind._isEventBogus(e, e.target)) {
var value, path;
if (e.detail) {
value = e.detail.value;
path = e.detail.path;
}
if (!this._clientsReadied) {
this._queueHandler([
fn,
e.target,
value,
path
]);
} else {
return fn.call(this, e.target, value, path);
}
}
},
_queueHandler: function (args) {
this._handlers.push(args);
},
_flushHandlers: function () {
var h$ = this._handlers;
for (var i = 0, l = h$.length, h; i < l && (h = h$[i]); i++) {
h[0].call(this, h[1], h[2], h[3]);
}
this._handlers = [];
}
});
}());
(function () {
'use strict';
Polymer.Base._addFeature({
notifyPath: function (path, value, fromAbove) {
var info = {};
var v = this._get(path, this, info);
if (arguments.length === 1) {
value = v;
}
if (info.path) {
this._notifyPath(info.path, value, fromAbove);
}
},
_notifyPath: function (path, value, fromAbove) {
var old = this._propertySetter(path, value);
if (old !== value && (old === old || value === value)) {
this._pathEffector(path, value);
if (!fromAbove) {
this._notifyPathUp(path, value);
}
return true;
}
},
_getPathParts: function (path) {
if (Array.isArray(path)) {
var parts = [];
for (var i = 0; i < path.length; i++) {
var args = path[i].toString().split('.');
for (var j = 0; j < args.length; j++) {
parts.push(args[j]);
}
}
return parts;
} else {
return path.toString().split('.');
}
},
set: function (path, value, root) {
var prop = root || this;
var parts = this._getPathParts(path);
var array;
var last = parts[parts.length - 1];
if (parts.length > 1) {
for (var i = 0; i < parts.length - 1; i++) {
var part = parts[i];
if (array && part[0] == '#') {
prop = Polymer.Collection.get(array).getItem(part);
} else {
prop = prop[part];
if (array && parseInt(part, 10) == part) {
parts[i] = Polymer.Collection.get(array).getKey(prop);
}
}
if (!prop) {
return;
}
array = Array.isArray(prop) ? prop : null;
}
if (array) {
var coll = Polymer.Collection.get(array);
var old, key;
if (last[0] == '#') {
key = last;
old = coll.getItem(key);
last = array.indexOf(old);
coll.setItem(key, value);
} else if (parseInt(last, 10) == last) {
old = prop[last];
key = coll.getKey(old);
parts[i] = key;
coll.setItem(key, value);
}
}
prop[last] = value;
if (!root) {
this._notifyPath(parts.join('.'), value);
}
} else {
prop[path] = value;
}
},
get: function (path, root) {
return this._get(path, root);
},
_get: function (path, root, info) {
var prop = root || this;
var parts = this._getPathParts(path);
var array;
for (var i = 0; i < parts.length; i++) {
if (!prop) {
return;
}
var part = parts[i];
if (array && part[0] == '#') {
prop = Polymer.Collection.get(array).getItem(part);
} else {
prop = prop[part];
if (info && array && parseInt(part, 10) == part) {
parts[i] = Polymer.Collection.get(array).getKey(prop);
}
}
array = Array.isArray(prop) ? prop : null;
}
if (info) {
info.path = parts.join('.');
}
return prop;
},
_pathEffector: function (path, value) {
var model = this._modelForPath(path);
var fx$ = this._propertyEffects && this._propertyEffects[model];
if (fx$) {
for (var i = 0, fx; i < fx$.length && (fx = fx$[i]); i++) {
var fxFn = fx.pathFn;
if (fxFn) {
fxFn.call(this, path, value, fx.effect);
}
}
}
if (this._boundPaths) {
this._notifyBoundPaths(path, value);
}
},
_annotationPathEffect: function (path, value, effect) {
if (effect.value === path || effect.value.indexOf(path + '.') === 0) {
Polymer.Bind._annotationEffect.call(this, path, value, effect);
} else if (path.indexOf(effect.value + '.') === 0 && !effect.negate) {
var node = this._nodes[effect.index];
if (node && node._notifyPath) {
var p = this._fixPath(effect.name, effect.value, path);
node._notifyPath(p, value, true);
}
}
},
_complexObserverPathEffect: function (path, value, effect) {
if (this._pathMatchesEffect(path, effect)) {
Polymer.Bind._complexObserverEffect.call(this, path, value, effect);
}
},
_computePathEffect: function (path, value, effect) {
if (this._pathMatchesEffect(path, effect)) {
Polymer.Bind._computeEffect.call(this, path, value, effect);
}
},
_annotatedComputationPathEffect: function (path, value, effect) {
if (this._pathMatchesEffect(path, effect)) {
Polymer.Bind._annotatedComputationEffect.call(this, path, value, effect);
}
},
_pathMatchesEffect: function (path, effect) {
var effectArg = effect.trigger.name;
return effectArg == path || effectArg.indexOf(path + '.') === 0 || effect.trigger.wildcard && path.indexOf(effectArg) === 0;
},
linkPaths: function (to, from) {
this._boundPaths = this._boundPaths || {};
if (from) {
this._boundPaths[to] = from;
} else {
this.unlinkPaths(to);
}
},
unlinkPaths: function (path) {
if (this._boundPaths) {
delete this._boundPaths[path];
}
},
_notifyBoundPaths: function (path, value) {
for (var a in this._boundPaths) {
var b = this._boundPaths[a];
if (path.indexOf(a + '.') == 0) {
this._notifyPath(this._fixPath(b, a, path), value);
} else if (path.indexOf(b + '.') == 0) {
this._notifyPath(this._fixPath(a, b, path), value);
}
}
},
_fixPath: function (property, root, path) {
return property + path.slice(root.length);
},
_notifyPathUp: function (path, value) {
var rootName = this._modelForPath(path);
var dashCaseName = Polymer.CaseMap.camelToDashCase(rootName);
var eventName = dashCaseName + this._EVENT_CHANGED;
this.fire(eventName, {
path: path,
value: value
}, {
bubbles: false,
_useCache: true
});
},
_modelForPath: function (path) {
var dot = path.indexOf('.');
return dot < 0 ? path : path.slice(0, dot);
},
_EVENT_CHANGED: '-changed',
notifySplices: function (path, splices) {
var info = {};
var array = this._get(path, this, info);
this._notifySplices(array, info.path, splices);
},
_notifySplices: function (array, path, splices) {
var change = {
keySplices: Polymer.Collection.applySplices(array, splices),
indexSplices: splices
};
var splicesPath = path + '.splices';
this._notifyPath(splicesPath, change);
this._notifyPath(path + '.length', array.length);
this.__data__[splicesPath] = {
keySplices: null,
indexSplices: null
};
},
_notifySplice: function (array, path, index, added, removed) {
this._notifySplices(array, path, [{
index: index,
addedCount: added,
removed: removed,
object: array,
type: 'splice'
}]);
},
push: function (path) {
var info = {};
var array = this._get(path, this, info);
var args = Array.prototype.slice.call(arguments, 1);
var len = array.length;
var ret = array.push.apply(array, args);
if (args.length) {
this._notifySplice(array, info.path, len, args.length, []);
}
return ret;
},
pop: function (path) {
var info = {};
var array = this._get(path, this, info);
var hadLength = Boolean(array.length);
var args = Array.prototype.slice.call(arguments, 1);
var ret = array.pop.apply(array, args);
if (hadLength) {
this._notifySplice(array, info.path, array.length, 0, [ret]);
}
return ret;
},
splice: function (path, start) {
var info = {};
var array = this._get(path, this, info);
if (start < 0) {
start = array.length - Math.floor(-start);
} else {
start = Math.floor(start);
}
if (!start) {
start = 0;
}
var args = Array.prototype.slice.call(arguments, 1);
var ret = array.splice.apply(array, args);
var addedCount = Math.max(args.length - 2, 0);
if (addedCount || ret.length) {
this._notifySplice(array, info.path, start, addedCount, ret);
}
return ret;
},
shift: function (path) {
var info = {};
var array = this._get(path, this, info);
var hadLength = Boolean(array.length);
var args = Array.prototype.slice.call(arguments, 1);
var ret = array.shift.apply(array, args);
if (hadLength) {
this._notifySplice(array, info.path, 0, 0, [ret]);
}
return ret;
},
unshift: function (path) {
var info = {};
var array = this._get(path, this, info);
var args = Array.prototype.slice.call(arguments, 1);
var ret = array.unshift.apply(array, args);
if (args.length) {
this._notifySplice(array, info.path, 0, args.length, []);
}
return ret;
},
prepareModelNotifyPath: function (model) {
this.mixin(model, {
fire: Polymer.Base.fire,
_getEvent: Polymer.Base._getEvent,
__eventCache: Polymer.Base.__eventCache,
notifyPath: Polymer.Base.notifyPath,
_get: Polymer.Base._get,
_EVENT_CHANGED: Polymer.Base._EVENT_CHANGED,
_notifyPath: Polymer.Base._notifyPath,
_notifyPathUp: Polymer.Base._notifyPathUp,
_pathEffector: Polymer.Base._pathEffector,
_annotationPathEffect: Polymer.Base._annotationPathEffect,
_complexObserverPathEffect: Polymer.Base._complexObserverPathEffect,
_annotatedComputationPathEffect: Polymer.Base._annotatedComputationPathEffect,
_computePathEffect: Polymer.Base._computePathEffect,
_modelForPath: Polymer.Base._modelForPath,
_pathMatchesEffect: Polymer.Base._pathMatchesEffect,
_notifyBoundPaths: Polymer.Base._notifyBoundPaths,
_getPathParts: Polymer.Base._getPathParts
});
}
});
}());
Polymer.Base._addFeature({
resolveUrl: function (url) {
var module = Polymer.DomModule.import(this.is);
var root = '';
if (module) {
var assetPath = module.getAttribute('assetpath') || '';
root = Polymer.ResolveUrl.resolveUrl(assetPath, module.ownerDocument.baseURI);
}
return Polymer.ResolveUrl.resolveUrl(url, root);
}
});
Polymer.CssParse = function () {
return {
parse: function (text) {
text = this._clean(text);
return this._parseCss(this._lex(text), text);
},
_clean: function (cssText) {
return cssText.replace(this._rx.comments, '').replace(this._rx.port, '');
},
_lex: function (text) {
var root = {
start: 0,
end: text.length
};
var n = root;
for (var i = 0, l = text.length; i < l; i++) {
switch (text[i]) {
case this.OPEN_BRACE:
if (!n.rules) {
n.rules = [];
}
var p = n;
var previous = p.rules[p.rules.length - 1];
n = {
start: i + 1,
parent: p,
previous: previous
};
p.rules.push(n);
break;
case this.CLOSE_BRACE:
n.end = i + 1;
n = n.parent || root;
break;
}
}
return root;
},
_parseCss: function (node, text) {
var t = text.substring(node.start, node.end - 1);
node.parsedCssText = node.cssText = t.trim();
if (node.parent) {
var ss = node.previous ? node.previous.end : node.parent.start;
t = text.substring(ss, node.start - 1);
t = this._expandUnicodeEscapes(t);
t = t.replace(this._rx.multipleSpaces, ' ');
t = t.substring(t.lastIndexOf(';') + 1);
var s = node.parsedSelector = node.selector = t.trim();
node.atRule = s.indexOf(this.AT_START) === 0;
if (node.atRule) {
if (s.indexOf(this.MEDIA_START) === 0) {
node.type = this.types.MEDIA_RULE;
} else if (s.match(this._rx.keyframesRule)) {
node.type = this.types.KEYFRAMES_RULE;
node.keyframesName = node.selector.split(this._rx.multipleSpaces).pop();
}
} else {
if (s.indexOf(this.VAR_START) === 0) {
node.type = this.types.MIXIN_RULE;
} else {
node.type = this.types.STYLE_RULE;
}
}
}
var r$ = node.rules;
if (r$) {
for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
this._parseCss(r, text);
}
}
return node;
},
_expandUnicodeEscapes: function (s) {
return s.replace(/\\([0-9a-f]{1,6})\s/gi, function () {
var code = arguments[1], repeat = 6 - code.length;
while (repeat--) {
code = '0' + code;
}
return '\\' + code;
});
},
stringify: function (node, preserveProperties, text) {
text = text || '';
var cssText = '';
if (node.cssText || node.rules) {
var r$ = node.rules;
if (r$ && (preserveProperties || !this._hasMixinRules(r$))) {
for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
cssText = this.stringify(r, preserveProperties, cssText);
}
} else {
cssText = preserveProperties ? node.cssText : this.removeCustomProps(node.cssText);
cssText = cssText.trim();
if (cssText) {
cssText = '  ' + cssText + '\n';
}
}
}
if (cssText) {
if (node.selector) {
text += node.selector + ' ' + this.OPEN_BRACE + '\n';
}
text += cssText;
if (node.selector) {
text += this.CLOSE_BRACE + '\n\n';
}
}
return text;
},
_hasMixinRules: function (rules) {
return rules[0].selector.indexOf(this.VAR_START) === 0;
},
removeCustomProps: function (cssText) {
cssText = this.removeCustomPropAssignment(cssText);
return this.removeCustomPropApply(cssText);
},
removeCustomPropAssignment: function (cssText) {
return cssText.replace(this._rx.customProp, '').replace(this._rx.mixinProp, '');
},
removeCustomPropApply: function (cssText) {
return cssText.replace(this._rx.mixinApply, '').replace(this._rx.varApply, '');
},
types: {
STYLE_RULE: 1,
KEYFRAMES_RULE: 7,
MEDIA_RULE: 4,
MIXIN_RULE: 1000
},
OPEN_BRACE: '{',
CLOSE_BRACE: '}',
_rx: {
comments: /\/\*[^*]*\*+([^\/*][^*]*\*+)*\//gim,
port: /@import[^;]*;/gim,
customProp: /(?:^[^;\-\s}]+)?--[^;{}]*?:[^{};]*?(?:[;\n]|$)/gim,
mixinProp: /(?:^[^;\-\s}]+)?--[^;{}]*?:[^{};]*?{[^}]*?}(?:[;\n]|$)?/gim,
mixinApply: /@apply[\s]*\([^)]*?\)[\s]*(?:[;\n]|$)?/gim,
varApply: /[^;:]*?:[^;]*?var\([^;]*\)(?:[;\n]|$)?/gim,
keyframesRule: /^@[^\s]*keyframes/,
multipleSpaces: /\s+/g
},
VAR_START: '--',
MEDIA_START: '@media',
AT_START: '@'
};
}();
Polymer.StyleUtil = function () {
return {
MODULE_STYLES_SELECTOR: 'style, link[rel=import][type~=css], template',
INCLUDE_ATTR: 'include',
toCssText: function (rules, callback, preserveProperties) {
if (typeof rules === 'string') {
rules = this.parser.parse(rules);
}
if (callback) {
this.forEachRule(rules, callback);
}
return this.parser.stringify(rules, preserveProperties);
},
forRulesInStyles: function (styles, styleRuleCallback, keyframesRuleCallback) {
if (styles) {
for (var i = 0, l = styles.length, s; i < l && (s = styles[i]); i++) {
this.forEachRule(this.rulesForStyle(s), styleRuleCallback, keyframesRuleCallback);
}
}
},
rulesForStyle: function (style) {
if (!style.__cssRules && style.textContent) {
style.__cssRules = this.parser.parse(style.textContent);
}
return style.__cssRules;
},
isKeyframesSelector: function (rule) {
return rule.parent && rule.parent.type === this.ruleTypes.KEYFRAMES_RULE;
},
forEachRule: function (node, styleRuleCallback, keyframesRuleCallback) {
if (!node) {
return;
}
var skipRules = false;
if (node.type === this.ruleTypes.STYLE_RULE) {
styleRuleCallback(node);
} else if (keyframesRuleCallback && node.type === this.ruleTypes.KEYFRAMES_RULE) {
keyframesRuleCallback(node);
} else if (node.type === this.ruleTypes.MIXIN_RULE) {
skipRules = true;
}
var r$ = node.rules;
if (r$ && !skipRules) {
for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
this.forEachRule(r, styleRuleCallback, keyframesRuleCallback);
}
}
},
applyCss: function (cssText, moniker, target, contextNode) {
var style = this.createScopeStyle(cssText, moniker);
return this.applyStyle(style, target, contextNode);
},
applyStyle: function (style, target, contextNode) {
target = target || document.head;
var after = contextNode && contextNode.nextSibling || target.firstChild;
this.__lastHeadApplyNode = style;
return target.insertBefore(style, after);
},
createScopeStyle: function (cssText, moniker) {
var style = document.createElement('style');
if (moniker) {
style.setAttribute('scope', moniker);
}
style.textContent = cssText;
return style;
},
__lastHeadApplyNode: null,
applyStylePlaceHolder: function (moniker) {
var placeHolder = document.createComment(' Shady DOM styles for ' + moniker + ' ');
var after = this.__lastHeadApplyNode ? this.__lastHeadApplyNode.nextSibling : null;
var scope = document.head;
scope.insertBefore(placeHolder, after || scope.firstChild);
this.__lastHeadApplyNode = placeHolder;
return placeHolder;
},
cssFromModules: function (moduleIds, warnIfNotFound) {
var modules = moduleIds.trim().split(' ');
var cssText = '';
for (var i = 0; i < modules.length; i++) {
cssText += this.cssFromModule(modules[i], warnIfNotFound);
}
return cssText;
},
cssFromModule: function (moduleId, warnIfNotFound) {
var m = Polymer.DomModule.import(moduleId);
if (m && !m._cssText) {
m._cssText = this.cssFromElement(m);
}
if (!m && warnIfNotFound) {
console.warn('Could not find style data in module named', moduleId);
}
return m && m._cssText || '';
},
cssFromElement: function (element) {
var cssText = '';
var content = element.content || element;
var e$ = Polymer.TreeApi.arrayCopy(content.querySelectorAll(this.MODULE_STYLES_SELECTOR));
for (var i = 0, e; i < e$.length; i++) {
e = e$[i];
if (e.localName === 'template') {
cssText += this.cssFromElement(e);
} else {
if (e.localName === 'style') {
var include = e.getAttribute(this.INCLUDE_ATTR);
if (include) {
cssText += this.cssFromModules(include, true);
}
e = e.__appliedElement || e;
e.parentNode.removeChild(e);
cssText += this.resolveCss(e.textContent, element.ownerDocument);
} else if (e.import && e.import.body) {
cssText += this.resolveCss(e.import.body.textContent, e.import);
}
}
}
return cssText;
},
resolveCss: Polymer.ResolveUrl.resolveCss,
parser: Polymer.CssParse,
ruleTypes: Polymer.CssParse.types
};
}();
Polymer.StyleTransformer = function () {
var nativeShadow = Polymer.Settings.useNativeShadow;
var styleUtil = Polymer.StyleUtil;
var api = {
dom: function (node, scope, useAttr, shouldRemoveScope) {
this._transformDom(node, scope || '', useAttr, shouldRemoveScope);
},
_transformDom: function (node, selector, useAttr, shouldRemoveScope) {
if (node.setAttribute) {
this.element(node, selector, useAttr, shouldRemoveScope);
}
var c$ = Polymer.dom(node).childNodes;
for (var i = 0; i < c$.length; i++) {
this._transformDom(c$[i], selector, useAttr, shouldRemoveScope);
}
},
element: function (element, scope, useAttr, shouldRemoveScope) {
if (useAttr) {
if (shouldRemoveScope) {
element.removeAttribute(SCOPE_NAME);
} else {
element.setAttribute(SCOPE_NAME, scope);
}
} else {
if (scope) {
if (element.classList) {
if (shouldRemoveScope) {
element.classList.remove(SCOPE_NAME);
element.classList.remove(scope);
} else {
element.classList.add(SCOPE_NAME);
element.classList.add(scope);
}
} else if (element.getAttribute) {
var c = element.getAttribute(CLASS);
if (shouldRemoveScope) {
if (c) {
element.setAttribute(CLASS, c.replace(SCOPE_NAME, '').replace(scope, ''));
}
} else {
element.setAttribute(CLASS, (c ? c + ' ' : '') + SCOPE_NAME + ' ' + scope);
}
}
}
}
},
elementStyles: function (element, callback) {
var styles = element._styles;
var cssText = '';
for (var i = 0, l = styles.length, s; i < l && (s = styles[i]); i++) {
var rules = styleUtil.rulesForStyle(s);
cssText += nativeShadow ? styleUtil.toCssText(rules, callback) : this.css(rules, element.is, element.extends, callback, element._scopeCssViaAttr) + '\n\n';
}
return cssText.trim();
},
css: function (rules, scope, ext, callback, useAttr) {
var hostScope = this._calcHostScope(scope, ext);
scope = this._calcElementScope(scope, useAttr);
var self = this;
return styleUtil.toCssText(rules, function (rule) {
if (!rule.isScoped) {
self.rule(rule, scope, hostScope);
rule.isScoped = true;
}
if (callback) {
callback(rule, scope, hostScope);
}
});
},
_calcElementScope: function (scope, useAttr) {
if (scope) {
return useAttr ? CSS_ATTR_PREFIX + scope + CSS_ATTR_SUFFIX : CSS_CLASS_PREFIX + scope;
} else {
return '';
}
},
_calcHostScope: function (scope, ext) {
return ext ? '[is=' + scope + ']' : scope;
},
rule: function (rule, scope, hostScope) {
this._transformRule(rule, this._transformComplexSelector, scope, hostScope);
},
_transformRule: function (rule, transformer, scope, hostScope) {
var p$ = rule.selector.split(COMPLEX_SELECTOR_SEP);
if (!styleUtil.isKeyframesSelector(rule)) {
for (var i = 0, l = p$.length, p; i < l && (p = p$[i]); i++) {
p$[i] = transformer.call(this, p, scope, hostScope);
}
}
rule.selector = rule.transformedSelector = p$.join(COMPLEX_SELECTOR_SEP);
},
_transformComplexSelector: function (selector, scope, hostScope) {
var stop = false;
var hostContext = false;
var self = this;
selector = selector.replace(CONTENT_START, HOST + ' $1');
selector = selector.replace(SIMPLE_SELECTOR_SEP, function (m, c, s) {
if (!stop) {
var info = self._transformCompoundSelector(s, c, scope, hostScope);
stop = stop || info.stop;
hostContext = hostContext || info.hostContext;
c = info.combinator;
s = info.value;
} else {
s = s.replace(SCOPE_JUMP, ' ');
}
return c + s;
});
if (hostContext) {
selector = selector.replace(HOST_CONTEXT_PAREN, function (m, pre, paren, post) {
return pre + paren + ' ' + hostScope + post + COMPLEX_SELECTOR_SEP + ' ' + pre + hostScope + paren + post;
});
}
return selector;
},
_transformCompoundSelector: function (selector, combinator, scope, hostScope) {
var jumpIndex = selector.search(SCOPE_JUMP);
var hostContext = false;
if (selector.indexOf(HOST_CONTEXT) >= 0) {
hostContext = true;
} else if (selector.indexOf(HOST) >= 0) {
selector = selector.replace(HOST_PAREN, function (m, host, paren) {
return hostScope + paren;
});
selector = selector.replace(HOST, hostScope);
} else if (jumpIndex !== 0) {
selector = scope ? this._transformSimpleSelector(selector, scope) : selector;
}
if (selector.indexOf(CONTENT) >= 0) {
combinator = '';
}
var stop;
if (jumpIndex >= 0) {
selector = selector.replace(SCOPE_JUMP, ' ');
stop = true;
}
return {
value: selector,
combinator: combinator,
stop: stop,
hostContext: hostContext
};
},
_transformSimpleSelector: function (selector, scope) {
var p$ = selector.split(PSEUDO_PREFIX);
p$[0] += scope;
return p$.join(PSEUDO_PREFIX);
},
documentRule: function (rule) {
rule.selector = rule.parsedSelector;
this.normalizeRootSelector(rule);
if (!nativeShadow) {
this._transformRule(rule, this._transformDocumentSelector);
}
},
normalizeRootSelector: function (rule) {
if (rule.selector === ROOT) {
rule.selector = 'body';
}
},
_transformDocumentSelector: function (selector) {
return selector.match(SCOPE_JUMP) ? this._transformComplexSelector(selector, SCOPE_DOC_SELECTOR) : this._transformSimpleSelector(selector.trim(), SCOPE_DOC_SELECTOR);
},
SCOPE_NAME: 'style-scope'
};
var SCOPE_NAME = api.SCOPE_NAME;
var SCOPE_DOC_SELECTOR = ':not([' + SCOPE_NAME + '])' + ':not(.' + SCOPE_NAME + ')';
var COMPLEX_SELECTOR_SEP = ',';
var SIMPLE_SELECTOR_SEP = /(^|[\s>+~]+)((?:\[.+?\]|[^\s>+~=\[])+)/g;
var HOST = ':host';
var ROOT = ':root';
var HOST_PAREN = /(:host)(?:\(((?:\([^)(]*\)|[^)(]*)+?)\))/g;
var HOST_CONTEXT = ':host-context';
var HOST_CONTEXT_PAREN = /(.*)(?::host-context)(?:\(((?:\([^)(]*\)|[^)(]*)+?)\))(.*)/;
var CONTENT = '::content';
var SCOPE_JUMP = /::content|::shadow|\/deep\//;
var CSS_CLASS_PREFIX = '.';
var CSS_ATTR_PREFIX = '[' + SCOPE_NAME + '~=';
var CSS_ATTR_SUFFIX = ']';
var PSEUDO_PREFIX = ':';
var CLASS = 'class';
var CONTENT_START = new RegExp('^(' + CONTENT + ')');
return api;
}();
Polymer.StyleExtends = function () {
var styleUtil = Polymer.StyleUtil;
return {
hasExtends: function (cssText) {
return Boolean(cssText.match(this.rx.EXTEND));
},
transform: function (style) {
var rules = styleUtil.rulesForStyle(style);
var self = this;
styleUtil.forEachRule(rules, function (rule) {
self._mapRuleOntoParent(rule);
if (rule.parent) {
var m;
while (m = self.rx.EXTEND.exec(rule.cssText)) {
var extend = m[1];
var extendor = self._findExtendor(extend, rule);
if (extendor) {
self._extendRule(rule, extendor);
}
}
}
rule.cssText = rule.cssText.replace(self.rx.EXTEND, '');
});
return styleUtil.toCssText(rules, function (rule) {
if (rule.selector.match(self.rx.STRIP)) {
rule.cssText = '';
}
}, true);
},
_mapRuleOntoParent: function (rule) {
if (rule.parent) {
var map = rule.parent.map || (rule.parent.map = {});
var parts = rule.selector.split(',');
for (var i = 0, p; i < parts.length; i++) {
p = parts[i];
map[p.trim()] = rule;
}
return map;
}
},
_findExtendor: function (extend, rule) {
return rule.parent && rule.parent.map && rule.parent.map[extend] || this._findExtendor(extend, rule.parent);
},
_extendRule: function (target, source) {
if (target.parent !== source.parent) {
this._cloneAndAddRuleToParent(source, target.parent);
}
target.extends = target.extends || [];
target.extends.push(source);
source.selector = source.selector.replace(this.rx.STRIP, '');
source.selector = (source.selector && source.selector + ',\n') + target.selector;
if (source.extends) {
source.extends.forEach(function (e) {
this._extendRule(target, e);
}, this);
}
},
_cloneAndAddRuleToParent: function (rule, parent) {
rule = Object.create(rule);
rule.parent = parent;
if (rule.extends) {
rule.extends = rule.extends.slice();
}
parent.rules.push(rule);
},
rx: {
EXTEND: /@extends\(([^)]*)\)\s*?;/gim,
STRIP: /%[^,]*$/
}
};
}();
(function () {
var prepElement = Polymer.Base._prepElement;
var nativeShadow = Polymer.Settings.useNativeShadow;
var styleUtil = Polymer.StyleUtil;
var styleTransformer = Polymer.StyleTransformer;
var styleExtends = Polymer.StyleExtends;
Polymer.Base._addFeature({
_prepElement: function (element) {
if (this._encapsulateStyle) {
styleTransformer.element(element, this.is, this._scopeCssViaAttr);
}
prepElement.call(this, element);
},
_prepStyles: function () {
if (!nativeShadow) {
this._scopeStyle = styleUtil.applyStylePlaceHolder(this.is);
}
},
_prepShimStyles: function () {
if (this._template) {
if (this._encapsulateStyle === undefined) {
this._encapsulateStyle = !nativeShadow;
}
this._styles = this._collectStyles();
var cssText = styleTransformer.elementStyles(this);
this._prepStyleProperties();
if (!this._needsStyleProperties() && this._styles.length) {
styleUtil.applyCss(cssText, this.is, nativeShadow ? this._template.content : null, this._scopeStyle);
}
} else {
this._styles = [];
}
},
_collectStyles: function () {
var styles = [];
var cssText = '', m$ = this.styleModules;
if (m$) {
for (var i = 0, l = m$.length, m; i < l && (m = m$[i]); i++) {
cssText += styleUtil.cssFromModule(m);
}
}
cssText += styleUtil.cssFromModule(this.is);
var p = this._template && this._template.parentNode;
if (this._template && (!p || p.id.toLowerCase() !== this.is)) {
cssText += styleUtil.cssFromElement(this._template);
}
if (cssText) {
var style = document.createElement('style');
style.textContent = cssText;
if (styleExtends.hasExtends(style.textContent)) {
cssText = styleExtends.transform(style);
}
styles.push(style);
}
return styles;
},
_elementAdd: function (node) {
if (this._encapsulateStyle) {
if (node.__styleScoped) {
node.__styleScoped = false;
} else {
styleTransformer.dom(node, this.is, this._scopeCssViaAttr);
}
}
},
_elementRemove: function (node) {
if (this._encapsulateStyle) {
styleTransformer.dom(node, this.is, this._scopeCssViaAttr, true);
}
},
scopeSubtree: function (container, shouldObserve) {
if (nativeShadow) {
return;
}
var self = this;
var scopify = function (node) {
if (node.nodeType === Node.ELEMENT_NODE) {
var className = node.getAttribute('class');
node.setAttribute('class', self._scopeElementClass(node, className));
var n$ = node.querySelectorAll('*');
for (var i = 0, n; i < n$.length && (n = n$[i]); i++) {
className = n.getAttribute('class');
n.setAttribute('class', self._scopeElementClass(n, className));
}
}
};
scopify(container);
if (shouldObserve) {
var mo = new MutationObserver(function (mxns) {
for (var i = 0, m; i < mxns.length && (m = mxns[i]); i++) {
if (m.addedNodes) {
for (var j = 0; j < m.addedNodes.length; j++) {
scopify(m.addedNodes[j]);
}
}
}
});
mo.observe(container, {
childList: true,
subtree: true
});
return mo;
}
}
});
}());
Polymer.StyleProperties = function () {
'use strict';
var nativeShadow = Polymer.Settings.useNativeShadow;
var matchesSelector = Polymer.DomApi.matchesSelector;
var styleUtil = Polymer.StyleUtil;
var styleTransformer = Polymer.StyleTransformer;
return {
decorateStyles: function (styles) {
var self = this, props = {}, keyframes = [];
styleUtil.forRulesInStyles(styles, function (rule) {
self.decorateRule(rule);
self.collectPropertiesInCssText(rule.propertyInfo.cssText, props);
}, function onKeyframesRule(rule) {
keyframes.push(rule);
});
styles._keyframes = keyframes;
var names = [];
for (var i in props) {
names.push(i);
}
return names;
},
decorateRule: function (rule) {
if (rule.propertyInfo) {
return rule.propertyInfo;
}
var info = {}, properties = {};
var hasProperties = this.collectProperties(rule, properties);
if (hasProperties) {
info.properties = properties;
rule.rules = null;
}
info.cssText = this.collectCssText(rule);
rule.propertyInfo = info;
return info;
},
collectProperties: function (rule, properties) {
var info = rule.propertyInfo;
if (info) {
if (info.properties) {
Polymer.Base.mixin(properties, info.properties);
return true;
}
} else {
var m, rx = this.rx.VAR_ASSIGN;
var cssText = rule.parsedCssText;
var any;
while (m = rx.exec(cssText)) {
properties[m[1]] = (m[2] || m[3]).trim();
any = true;
}
return any;
}
},
collectCssText: function (rule) {
return this.collectConsumingCssText(rule.parsedCssText);
},
collectConsumingCssText: function (cssText) {
return cssText.replace(this.rx.BRACKETED, '').replace(this.rx.VAR_ASSIGN, '');
},
collectPropertiesInCssText: function (cssText, props) {
var m;
while (m = this.rx.VAR_CAPTURE.exec(cssText)) {
props[m[1]] = true;
var def = m[2];
if (def && def.match(this.rx.IS_VAR)) {
props[def] = true;
}
}
},
reify: function (props) {
var names = Object.getOwnPropertyNames(props);
for (var i = 0, n; i < names.length; i++) {
n = names[i];
props[n] = this.valueForProperty(props[n], props);
}
},
valueForProperty: function (property, props) {
if (property) {
if (property.indexOf(';') >= 0) {
property = this.valueForProperties(property, props);
} else {
var self = this;
var fn = function (all, prefix, value, fallback) {
var propertyValue = self.valueForProperty(props[value], props) || (props[fallback] ? self.valueForProperty(props[fallback], props) : fallback);
return prefix + (propertyValue || '');
};
property = property.replace(this.rx.VAR_MATCH, fn);
}
}
return property && property.trim() || '';
},
valueForProperties: function (property, props) {
var parts = property.split(';');
for (var i = 0, p, m; i < parts.length; i++) {
if (p = parts[i]) {
m = p.match(this.rx.MIXIN_MATCH);
if (m) {
p = this.valueForProperty(props[m[1]], props);
} else {
var colon = p.indexOf(':');
if (colon !== -1) {
var pp = p.substring(colon);
pp = pp.trim();
pp = this.valueForProperty(pp, props) || pp;
p = p.substring(0, colon) + pp;
}
}
parts[i] = p && p.lastIndexOf(';') === p.length - 1 ? p.slice(0, -1) : p || '';
}
}
return parts.join(';');
},
applyProperties: function (rule, props) {
var output = '';
if (!rule.propertyInfo) {
this.decorateRule(rule);
}
if (rule.propertyInfo.cssText) {
output = this.valueForProperties(rule.propertyInfo.cssText, props);
}
rule.cssText = output;
},
applyKeyframeTransforms: function (rule, keyframeTransforms) {
var input = rule.cssText;
var output = rule.cssText;
if (rule.hasAnimations == null) {
rule.hasAnimations = this.rx.ANIMATION_MATCH.test(input);
}
if (rule.hasAnimations) {
var transform;
if (rule.keyframeNamesToTransform == null) {
rule.keyframeNamesToTransform = [];
for (var keyframe in keyframeTransforms) {
transform = keyframeTransforms[keyframe];
output = transform(input);
if (input !== output) {
input = output;
rule.keyframeNamesToTransform.push(keyframe);
}
}
} else {
for (var i = 0; i < rule.keyframeNamesToTransform.length; ++i) {
transform = keyframeTransforms[rule.keyframeNamesToTransform[i]];
input = transform(input);
}
output = input;
}
}
rule.cssText = output;
},
propertyDataFromStyles: function (styles, element) {
var props = {}, self = this;
var o = [], i = 0;
styleUtil.forRulesInStyles(styles, function (rule) {
if (!rule.propertyInfo) {
self.decorateRule(rule);
}
if (element && rule.propertyInfo.properties && matchesSelector.call(element, rule.transformedSelector || rule.parsedSelector)) {
self.collectProperties(rule, props);
addToBitMask(i, o);
}
i++;
});
return {
properties: props,
key: o
};
},
scopePropertiesFromStyles: function (styles) {
if (!styles._scopeStyleProperties) {
styles._scopeStyleProperties = this.selectedPropertiesFromStyles(styles, this.SCOPE_SELECTORS);
}
return styles._scopeStyleProperties;
},
hostPropertiesFromStyles: function (styles) {
if (!styles._hostStyleProperties) {
styles._hostStyleProperties = this.selectedPropertiesFromStyles(styles, this.HOST_SELECTORS);
}
return styles._hostStyleProperties;
},
selectedPropertiesFromStyles: function (styles, selectors) {
var props = {}, self = this;
styleUtil.forRulesInStyles(styles, function (rule) {
if (!rule.propertyInfo) {
self.decorateRule(rule);
}
for (var i = 0; i < selectors.length; i++) {
if (rule.parsedSelector === selectors[i]) {
self.collectProperties(rule, props);
return;
}
}
});
return props;
},
transformStyles: function (element, properties, scopeSelector) {
var self = this;
var hostSelector = styleTransformer._calcHostScope(element.is, element.extends);
var rxHostSelector = element.extends ? '\\' + hostSelector.slice(0, -1) + '\\]' : hostSelector;
var hostRx = new RegExp(this.rx.HOST_PREFIX + rxHostSelector + this.rx.HOST_SUFFIX);
var keyframeTransforms = this._elementKeyframeTransforms(element, scopeSelector);
return styleTransformer.elementStyles(element, function (rule) {
self.applyProperties(rule, properties);
if (!nativeShadow && !Polymer.StyleUtil.isKeyframesSelector(rule) && rule.cssText) {
self.applyKeyframeTransforms(rule, keyframeTransforms);
self._scopeSelector(rule, hostRx, hostSelector, element._scopeCssViaAttr, scopeSelector);
}
});
},
_elementKeyframeTransforms: function (element, scopeSelector) {
var keyframesRules = element._styles._keyframes;
var keyframeTransforms = {};
if (!nativeShadow && keyframesRules) {
for (var i = 0, keyframesRule = keyframesRules[i]; i < keyframesRules.length; keyframesRule = keyframesRules[++i]) {
this._scopeKeyframes(keyframesRule, scopeSelector);
keyframeTransforms[keyframesRule.keyframesName] = this._keyframesRuleTransformer(keyframesRule);
}
}
return keyframeTransforms;
},
_keyframesRuleTransformer: function (keyframesRule) {
return function (cssText) {
return cssText.replace(keyframesRule.keyframesNameRx, keyframesRule.transformedKeyframesName);
};
},
_scopeKeyframes: function (rule, scopeId) {
rule.keyframesNameRx = new RegExp(rule.keyframesName, 'g');
rule.transformedKeyframesName = rule.keyframesName + '-' + scopeId;
rule.transformedSelector = rule.transformedSelector || rule.selector;
rule.selector = rule.transformedSelector.replace(rule.keyframesName, rule.transformedKeyframesName);
},
_scopeSelector: function (rule, hostRx, hostSelector, viaAttr, scopeId) {
rule.transformedSelector = rule.transformedSelector || rule.selector;
var selector = rule.transformedSelector;
var scope = viaAttr ? '[' + styleTransformer.SCOPE_NAME + '~=' + scopeId + ']' : '.' + scopeId;
var parts = selector.split(',');
for (var i = 0, l = parts.length, p; i < l && (p = parts[i]); i++) {
parts[i] = p.match(hostRx) ? p.replace(hostSelector, scope) : scope + ' ' + p;
}
rule.selector = parts.join(',');
},
applyElementScopeSelector: function (element, selector, old, viaAttr) {
var c = viaAttr ? element.getAttribute(styleTransformer.SCOPE_NAME) : element.getAttribute('class') || '';
var v = old ? c.replace(old, selector) : (c ? c + ' ' : '') + this.XSCOPE_NAME + ' ' + selector;
if (c !== v) {
if (viaAttr) {
element.setAttribute(styleTransformer.SCOPE_NAME, v);
} else {
element.setAttribute('class', v);
}
}
},
applyElementStyle: function (element, properties, selector, style) {
var cssText = style ? style.textContent || '' : this.transformStyles(element, properties, selector);
var s = element._customStyle;
if (s && !nativeShadow && s !== style) {
s._useCount--;
if (s._useCount <= 0 && s.parentNode) {
s.parentNode.removeChild(s);
}
}
if (nativeShadow) {
if (element._customStyle) {
element._customStyle.textContent = cssText;
style = element._customStyle;
} else if (cssText) {
style = styleUtil.applyCss(cssText, selector, element.root);
}
} else {
if (!style) {
if (cssText) {
style = styleUtil.applyCss(cssText, selector, null, element._scopeStyle);
}
} else if (!style.parentNode) {
styleUtil.applyStyle(style, null, element._scopeStyle);
}
}
if (style) {
style._useCount = style._useCount || 0;
if (element._customStyle != style) {
style._useCount++;
}
element._customStyle = style;
}
return style;
},
mixinCustomStyle: function (props, customStyle) {
var v;
for (var i in customStyle) {
v = customStyle[i];
if (v || v === 0) {
props[i] = v;
}
}
},
rx: {
VAR_ASSIGN: /(?:^|[;\s{]\s*)(--[\w-]*?)\s*:\s*(?:([^;{]*)|{([^}]*)})(?:(?=[;\s}])|$)/gi,
MIXIN_MATCH: /(?:^|\W+)@apply[\s]*\(([^)]*)\)/i,
VAR_MATCH: /(^|\W+)var\([\s]*([^,)]*)[\s]*,?[\s]*((?:[^,()]*)|(?:[^;()]*\([^;)]*\)))[\s]*?\)/gi,
VAR_CAPTURE: /\([\s]*(--[^,\s)]*)(?:,[\s]*(--[^,\s)]*))?(?:\)|,)/gi,
ANIMATION_MATCH: /(animation\s*:)|(animation-name\s*:)/,
IS_VAR: /^--/,
BRACKETED: /\{[^}]*\}/g,
HOST_PREFIX: '(?:^|[^.#[:])',
HOST_SUFFIX: '($|[.:[\\s>+~])'
},
HOST_SELECTORS: [':host'],
SCOPE_SELECTORS: [':root'],
XSCOPE_NAME: 'x-scope'
};
function addToBitMask(n, bits) {
var o = parseInt(n / 32);
var v = 1 << n % 32;
bits[o] = (bits[o] || 0) | v;
}
}();
(function () {
Polymer.StyleCache = function () {
this.cache = {};
};
Polymer.StyleCache.prototype = {
MAX: 100,
store: function (is, data, keyValues, keyStyles) {
data.keyValues = keyValues;
data.styles = keyStyles;
var s$ = this.cache[is] = this.cache[is] || [];
s$.push(data);
if (s$.length > this.MAX) {
s$.shift();
}
},
retrieve: function (is, keyValues, keyStyles) {
var cache = this.cache[is];
if (cache) {
for (var i = cache.length - 1, data; i >= 0; i--) {
data = cache[i];
if (keyStyles === data.styles && this._objectsEqual(keyValues, data.keyValues)) {
return data;
}
}
}
},
clear: function () {
this.cache = {};
},
_objectsEqual: function (target, source) {
var t, s;
for (var i in target) {
t = target[i], s = source[i];
if (!(typeof t === 'object' && t ? this._objectsStrictlyEqual(t, s) : t === s)) {
return false;
}
}
if (Array.isArray(target)) {
return target.length === source.length;
}
return true;
},
_objectsStrictlyEqual: function (target, source) {
return this._objectsEqual(target, source) && this._objectsEqual(source, target);
}
};
}());
Polymer.StyleDefaults = function () {
var styleProperties = Polymer.StyleProperties;
var StyleCache = Polymer.StyleCache;
var api = {
_styles: [],
_properties: null,
customStyle: {},
_styleCache: new StyleCache(),
addStyle: function (style) {
this._styles.push(style);
this._properties = null;
},
get _styleProperties() {
if (!this._properties) {
styleProperties.decorateStyles(this._styles);
this._styles._scopeStyleProperties = null;
this._properties = styleProperties.scopePropertiesFromStyles(this._styles);
styleProperties.mixinCustomStyle(this._properties, this.customStyle);
styleProperties.reify(this._properties);
}
return this._properties;
},
_needsStyleProperties: function () {
},
_computeStyleProperties: function () {
return this._styleProperties;
},
updateStyles: function (properties) {
this._properties = null;
if (properties) {
Polymer.Base.mixin(this.customStyle, properties);
}
this._styleCache.clear();
for (var i = 0, s; i < this._styles.length; i++) {
s = this._styles[i];
s = s.__importElement || s;
s._apply();
}
}
};
return api;
}();
(function () {
'use strict';
var serializeValueToAttribute = Polymer.Base.serializeValueToAttribute;
var propertyUtils = Polymer.StyleProperties;
var styleTransformer = Polymer.StyleTransformer;
var styleDefaults = Polymer.StyleDefaults;
var nativeShadow = Polymer.Settings.useNativeShadow;
Polymer.Base._addFeature({
_prepStyleProperties: function () {
this._ownStylePropertyNames = this._styles && this._styles.length ? propertyUtils.decorateStyles(this._styles) : null;
},
customStyle: null,
getComputedStyleValue: function (property) {
return this._styleProperties && this._styleProperties[property] || getComputedStyle(this).getPropertyValue(property);
},
_setupStyleProperties: function () {
this.customStyle = {};
this._styleCache = null;
this._styleProperties = null;
this._scopeSelector = null;
this._ownStyleProperties = null;
this._customStyle = null;
},
_needsStyleProperties: function () {
return Boolean(this._ownStylePropertyNames && this._ownStylePropertyNames.length);
},
_beforeAttached: function () {
if (!this._scopeSelector && this._needsStyleProperties()) {
this._updateStyleProperties();
}
},
_findStyleHost: function () {
var e = this, root;
while (root = Polymer.dom(e).getOwnerRoot()) {
if (Polymer.isInstance(root.host)) {
return root.host;
}
e = root.host;
}
return styleDefaults;
},
_updateStyleProperties: function () {
var info, scope = this._findStyleHost();
if (!scope._styleCache) {
scope._styleCache = new Polymer.StyleCache();
}
var scopeData = propertyUtils.propertyDataFromStyles(scope._styles, this);
scopeData.key.customStyle = this.customStyle;
info = scope._styleCache.retrieve(this.is, scopeData.key, this._styles);
var scopeCached = Boolean(info);
if (scopeCached) {
this._styleProperties = info._styleProperties;
} else {
this._computeStyleProperties(scopeData.properties);
}
this._computeOwnStyleProperties();
if (!scopeCached) {
info = styleCache.retrieve(this.is, this._ownStyleProperties, this._styles);
}
var globalCached = Boolean(info) && !scopeCached;
var style = this._applyStyleProperties(info);
if (!scopeCached) {
style = style && nativeShadow ? style.cloneNode(true) : style;
info = {
style: style,
_scopeSelector: this._scopeSelector,
_styleProperties: this._styleProperties
};
scopeData.key.customStyle = {};
this.mixin(scopeData.key.customStyle, this.customStyle);
scope._styleCache.store(this.is, info, scopeData.key, this._styles);
if (!globalCached) {
styleCache.store(this.is, Object.create(info), this._ownStyleProperties, this._styles);
}
}
},
_computeStyleProperties: function (scopeProps) {
var scope = this._findStyleHost();
if (!scope._styleProperties) {
scope._computeStyleProperties();
}
var props = Object.create(scope._styleProperties);
this.mixin(props, propertyUtils.hostPropertiesFromStyles(this._styles));
scopeProps = scopeProps || propertyUtils.propertyDataFromStyles(scope._styles, this).properties;
this.mixin(props, scopeProps);
this.mixin(props, propertyUtils.scopePropertiesFromStyles(this._styles));
propertyUtils.mixinCustomStyle(props, this.customStyle);
propertyUtils.reify(props);
this._styleProperties = props;
},
_computeOwnStyleProperties: function () {
var props = {};
for (var i = 0, n; i < this._ownStylePropertyNames.length; i++) {
n = this._ownStylePropertyNames[i];
props[n] = this._styleProperties[n];
}
this._ownStyleProperties = props;
},
_scopeCount: 0,
_applyStyleProperties: function (info) {
var oldScopeSelector = this._scopeSelector;
this._scopeSelector = info ? info._scopeSelector : this.is + '-' + this.__proto__._scopeCount++;
var style = propertyUtils.applyElementStyle(this, this._styleProperties, this._scopeSelector, info && info.style);
if (!nativeShadow) {
propertyUtils.applyElementScopeSelector(this, this._scopeSelector, oldScopeSelector, this._scopeCssViaAttr);
}
return style;
},
serializeValueToAttribute: function (value, attribute, node) {
node = node || this;
if (attribute === 'class' && !nativeShadow) {
var host = node === this ? this.domHost || this.dataHost : this;
if (host) {
value = host._scopeElementClass(node, value);
}
}
node = this.shadyRoot && this.shadyRoot._hasDistributed ? Polymer.dom(node) : node;
serializeValueToAttribute.call(this, value, attribute, node);
},
_scopeElementClass: function (element, selector) {
if (!nativeShadow && !this._scopeCssViaAttr) {
selector = (selector ? selector + ' ' : '') + SCOPE_NAME + ' ' + this.is + (element._scopeSelector ? ' ' + XSCOPE_NAME + ' ' + element._scopeSelector : '');
}
return selector;
},
updateStyles: function (properties) {
if (this.isAttached) {
if (properties) {
this.mixin(this.customStyle, properties);
}
if (this._needsStyleProperties()) {
this._updateStyleProperties();
} else {
this._styleProperties = null;
}
if (this._styleCache) {
this._styleCache.clear();
}
this._updateRootStyles();
}
},
_updateRootStyles: function (root) {
root = root || this.root;
var c$ = Polymer.dom(root)._query(function (e) {
return e.shadyRoot || e.shadowRoot;
});
for (var i = 0, l = c$.length, c; i < l && (c = c$[i]); i++) {
if (c.updateStyles) {
c.updateStyles();
}
}
}
});
Polymer.updateStyles = function (properties) {
styleDefaults.updateStyles(properties);
Polymer.Base._updateRootStyles(document);
};
var styleCache = new Polymer.StyleCache();
Polymer.customStyleCache = styleCache;
var SCOPE_NAME = styleTransformer.SCOPE_NAME;
var XSCOPE_NAME = propertyUtils.XSCOPE_NAME;
}());
Polymer.Base._addFeature({
_registerFeatures: function () {
this._prepIs();
this._prepConstructor();
this._prepStyles();
},
_finishRegisterFeatures: function () {
this._prepTemplate();
this._prepShimStyles();
this._prepAnnotations();
this._prepEffects();
this._prepBehaviors();
this._prepPropertyInfo();
this._prepBindings();
this._prepShady();
},
_prepBehavior: function (b) {
this._addPropertyEffects(b.properties);
this._addComplexObserverEffects(b.observers);
this._addHostAttributes(b.hostAttributes);
},
_initFeatures: function () {
this._setupGestures();
this._setupConfigure();
this._setupStyleProperties();
this._setupDebouncers();
this._setupShady();
this._registerHost();
if (this._template) {
this._poolContent();
this._beginHosting();
this._stampTemplate();
this._endHosting();
this._marshalAnnotationReferences();
}
this._marshalInstanceEffects();
this._marshalBehaviors();
this._marshalHostAttributes();
this._marshalAttributes();
this._tryReady();
},
_marshalBehavior: function (b) {
if (b.listeners) {
this._listenListeners(b.listeners);
}
}
});
(function () {
var propertyUtils = Polymer.StyleProperties;
var styleUtil = Polymer.StyleUtil;
var cssParse = Polymer.CssParse;
var styleDefaults = Polymer.StyleDefaults;
var styleTransformer = Polymer.StyleTransformer;
Polymer({
is: 'custom-style',
extends: 'style',
_template: null,
properties: { include: String },
ready: function () {
this._tryApply();
},
attached: function () {
this._tryApply();
},
_tryApply: function () {
if (!this._appliesToDocument) {
if (this.parentNode && this.parentNode.localName !== 'dom-module') {
this._appliesToDocument = true;
var e = this.__appliedElement || this;
styleDefaults.addStyle(e);
if (e.textContent || this.include) {
this._apply(true);
} else {
var self = this;
var observer = new MutationObserver(function () {
observer.disconnect();
self._apply(true);
});
observer.observe(e, { childList: true });
}
}
}
},
_apply: function (deferProperties) {
var e = this.__appliedElement || this;
if (this.include) {
e.textContent = styleUtil.cssFromModules(this.include, true) + e.textContent;
}
if (e.textContent) {
styleUtil.forEachRule(styleUtil.rulesForStyle(e), function (rule) {
styleTransformer.documentRule(rule);
});
var self = this;
var fn = function fn() {
self._applyCustomProperties(e);
};
if (this._pendingApplyProperties) {
cancelAnimationFrame(this._pendingApplyProperties);
this._pendingApplyProperties = null;
}
if (deferProperties) {
this._pendingApplyProperties = requestAnimationFrame(fn);
} else {
fn();
}
}
},
_applyCustomProperties: function (element) {
this._computeStyleProperties();
var props = this._styleProperties;
var rules = styleUtil.rulesForStyle(element);
element.textContent = styleUtil.toCssText(rules, function (rule) {
var css = rule.cssText = rule.parsedCssText;
if (rule.propertyInfo && rule.propertyInfo.cssText) {
css = cssParse.removeCustomPropAssignment(css);
rule.cssText = propertyUtils.valueForProperties(css, props);
}
});
}
});
}());
Polymer.Templatizer = {
properties: { __hideTemplateChildren__: { observer: '_showHideChildren' } },
_instanceProps: Polymer.nob,
_parentPropPrefix: '_parent_',
templatize: function (template) {
this._templatized = template;
if (!template._content) {
template._content = template.content;
}
if (template._content._ctor) {
this.ctor = template._content._ctor;
this._prepParentProperties(this.ctor.prototype, template);
return;
}
var archetype = Object.create(Polymer.Base);
this._customPrepAnnotations(archetype, template);
this._prepParentProperties(archetype, template);
archetype._prepEffects();
this._customPrepEffects(archetype);
archetype._prepBehaviors();
archetype._prepPropertyInfo();
archetype._prepBindings();
archetype._notifyPathUp = this._notifyPathUpImpl;
archetype._scopeElementClass = this._scopeElementClassImpl;
archetype.listen = this._listenImpl;
archetype._showHideChildren = this._showHideChildrenImpl;
archetype.__setPropertyOrig = this.__setProperty;
archetype.__setProperty = this.__setPropertyImpl;
var _constructor = this._constructorImpl;
var ctor = function TemplateInstance(model, host) {
_constructor.call(this, model, host);
};
ctor.prototype = archetype;
archetype.constructor = ctor;
template._content._ctor = ctor;
this.ctor = ctor;
},
_getRootDataHost: function () {
return this.dataHost && this.dataHost._rootDataHost || this.dataHost;
},
_showHideChildrenImpl: function (hide) {
var c = this._children;
for (var i = 0; i < c.length; i++) {
var n = c[i];
if (Boolean(hide) != Boolean(n.__hideTemplateChildren__)) {
if (n.nodeType === Node.TEXT_NODE) {
if (hide) {
n.__polymerTextContent__ = n.textContent;
n.textContent = '';
} else {
n.textContent = n.__polymerTextContent__;
}
} else if (n.style) {
if (hide) {
n.__polymerDisplay__ = n.style.display;
n.style.display = 'none';
} else {
n.style.display = n.__polymerDisplay__;
}
}
}
n.__hideTemplateChildren__ = hide;
}
},
__setPropertyImpl: function (property, value, fromAbove, node) {
if (node && node.__hideTemplateChildren__ && property == 'textContent') {
property = '__polymerTextContent__';
}
this.__setPropertyOrig(property, value, fromAbove, node);
},
_debounceTemplate: function (fn) {
Polymer.dom.addDebouncer(this.debounce('_debounceTemplate', fn));
},
_flushTemplates: function () {
Polymer.dom.flush();
},
_customPrepEffects: function (archetype) {
var parentProps = archetype._parentProps;
for (var prop in parentProps) {
archetype._addPropertyEffect(prop, 'function', this._createHostPropEffector(prop));
}
for (prop in this._instanceProps) {
archetype._addPropertyEffect(prop, 'function', this._createInstancePropEffector(prop));
}
},
_customPrepAnnotations: function (archetype, template) {
archetype._template = template;
var c = template._content;
if (!c._notes) {
var rootDataHost = archetype._rootDataHost;
if (rootDataHost) {
Polymer.Annotations.prepElement = function () {
rootDataHost._prepElement();
};
}
c._notes = Polymer.Annotations.parseAnnotations(template);
Polymer.Annotations.prepElement = null;
this._processAnnotations(c._notes);
}
archetype._notes = c._notes;
archetype._parentProps = c._parentProps;
},
_prepParentProperties: function (archetype, template) {
var parentProps = this._parentProps = archetype._parentProps;
if (this._forwardParentProp && parentProps) {
var proto = archetype._parentPropProto;
var prop;
if (!proto) {
for (prop in this._instanceProps) {
delete parentProps[prop];
}
proto = archetype._parentPropProto = Object.create(null);
if (template != this) {
Polymer.Bind.prepareModel(proto);
Polymer.Base.prepareModelNotifyPath(proto);
}
for (prop in parentProps) {
var parentProp = this._parentPropPrefix + prop;
var effects = [
{
kind: 'function',
effect: this._createForwardPropEffector(prop),
fn: Polymer.Bind._functionEffect
},
{
kind: 'notify',
fn: Polymer.Bind._notifyEffect,
effect: { event: Polymer.CaseMap.camelToDashCase(parentProp) + '-changed' }
}
];
Polymer.Bind._createAccessors(proto, parentProp, effects);
}
}
var self = this;
if (template != this) {
Polymer.Bind.prepareInstance(template);
template._forwardParentProp = function (source, value) {
self._forwardParentProp(source, value);
};
}
this._extendTemplate(template, proto);
template._pathEffector = function (path, value, fromAbove) {
return self._pathEffectorImpl(path, value, fromAbove);
};
}
},
_createForwardPropEffector: function (prop) {
return function (source, value) {
this._forwardParentProp(prop, value);
};
},
_createHostPropEffector: function (prop) {
var prefix = this._parentPropPrefix;
return function (source, value) {
this.dataHost._templatized[prefix + prop] = value;
};
},
_createInstancePropEffector: function (prop) {
return function (source, value, old, fromAbove) {
if (!fromAbove) {
this.dataHost._forwardInstanceProp(this, prop, value);
}
};
},
_extendTemplate: function (template, proto) {
var n$ = Object.getOwnPropertyNames(proto);
if (proto._propertySetter) {
template._propertySetter = proto._propertySetter;
}
for (var i = 0, n; i < n$.length && (n = n$[i]); i++) {
var val = template[n];
var pd = Object.getOwnPropertyDescriptor(proto, n);
Object.defineProperty(template, n, pd);
if (val !== undefined) {
template._propertySetter(n, val);
}
}
},
_showHideChildren: function (hidden) {
},
_forwardInstancePath: function (inst, path, value) {
},
_forwardInstanceProp: function (inst, prop, value) {
},
_notifyPathUpImpl: function (path, value) {
var dataHost = this.dataHost;
var dot = path.indexOf('.');
var root = dot < 0 ? path : path.slice(0, dot);
dataHost._forwardInstancePath.call(dataHost, this, path, value);
if (root in dataHost._parentProps) {
dataHost._templatized._notifyPath(dataHost._parentPropPrefix + path, value);
}
},
_pathEffectorImpl: function (path, value, fromAbove) {
if (this._forwardParentPath) {
if (path.indexOf(this._parentPropPrefix) === 0) {
var subPath = path.substring(this._parentPropPrefix.length);
var model = this._modelForPath(subPath);
if (model in this._parentProps) {
this._forwardParentPath(subPath, value);
}
}
}
Polymer.Base._pathEffector.call(this._templatized, path, value, fromAbove);
},
_constructorImpl: function (model, host) {
this._rootDataHost = host._getRootDataHost();
this._setupConfigure(model);
this._registerHost(host);
this._beginHosting();
this.root = this.instanceTemplate(this._template);
this.root.__noContent = !this._notes._hasContent;
this.root.__styleScoped = true;
this._endHosting();
this._marshalAnnotatedNodes();
this._marshalInstanceEffects();
this._marshalAnnotatedListeners();
var children = [];
for (var n = this.root.firstChild; n; n = n.nextSibling) {
children.push(n);
n._templateInstance = this;
}
this._children = children;
if (host.__hideTemplateChildren__) {
this._showHideChildren(true);
}
this._tryReady();
},
_listenImpl: function (node, eventName, methodName) {
var model = this;
var host = this._rootDataHost;
var handler = host._createEventHandler(node, eventName, methodName);
var decorated = function (e) {
e.model = model;
handler(e);
};
host._listen(node, eventName, decorated);
},
_scopeElementClassImpl: function (node, value) {
var host = this._rootDataHost;
if (host) {
return host._scopeElementClass(node, value);
}
return value;
},
stamp: function (model) {
model = model || {};
if (this._parentProps) {
var templatized = this._templatized;
for (var prop in this._parentProps) {
if (model[prop] === undefined) {
model[prop] = templatized[this._parentPropPrefix + prop];
}
}
}
return new this.ctor(model, this);
},
modelForElement: function (el) {
var model;
while (el) {
if (model = el._templateInstance) {
if (model.dataHost != this) {
el = model.dataHost;
} else {
return model;
}
} else {
el = el.parentNode;
}
}
}
};
Polymer({
is: 'dom-template',
extends: 'template',
_template: null,
behaviors: [Polymer.Templatizer],
ready: function () {
this.templatize(this);
}
});
Polymer._collections = new WeakMap();
Polymer.Collection = function (userArray) {
Polymer._collections.set(userArray, this);
this.userArray = userArray;
this.store = userArray.slice();
this.initMap();
};
Polymer.Collection.prototype = {
constructor: Polymer.Collection,
initMap: function () {
var omap = this.omap = new WeakMap();
var pmap = this.pmap = {};
var s = this.store;
for (var i = 0; i < s.length; i++) {
var item = s[i];
if (item && typeof item == 'object') {
omap.set(item, i);
} else {
pmap[item] = i;
}
}
},
add: function (item) {
var key = this.store.push(item) - 1;
if (item && typeof item == 'object') {
this.omap.set(item, key);
} else {
this.pmap[item] = key;
}
return '#' + key;
},
removeKey: function (key) {
if (key = this._parseKey(key)) {
this._removeFromMap(this.store[key]);
delete this.store[key];
}
},
_removeFromMap: function (item) {
if (item && typeof item == 'object') {
this.omap.delete(item);
} else {
delete this.pmap[item];
}
},
remove: function (item) {
var key = this.getKey(item);
this.removeKey(key);
return key;
},
getKey: function (item) {
var key;
if (item && typeof item == 'object') {
key = this.omap.get(item);
} else {
key = this.pmap[item];
}
if (key != undefined) {
return '#' + key;
}
},
getKeys: function () {
return Object.keys(this.store).map(function (key) {
return '#' + key;
});
},
_parseKey: function (key) {
if (key && key[0] == '#') {
return key.slice(1);
}
},
setItem: function (key, item) {
if (key = this._parseKey(key)) {
var old = this.store[key];
if (old) {
this._removeFromMap(old);
}
if (item && typeof item == 'object') {
this.omap.set(item, key);
} else {
this.pmap[item] = key;
}
this.store[key] = item;
}
},
getItem: function (key) {
if (key = this._parseKey(key)) {
return this.store[key];
}
},
getItems: function () {
var items = [], store = this.store;
for (var key in store) {
items.push(store[key]);
}
return items;
},
_applySplices: function (splices) {
var keyMap = {}, key;
for (var i = 0, s; i < splices.length && (s = splices[i]); i++) {
s.addedKeys = [];
for (var j = 0; j < s.removed.length; j++) {
key = this.getKey(s.removed[j]);
keyMap[key] = keyMap[key] ? null : -1;
}
for (j = 0; j < s.addedCount; j++) {
var item = this.userArray[s.index + j];
key = this.getKey(item);
key = key === undefined ? this.add(item) : key;
keyMap[key] = keyMap[key] ? null : 1;
s.addedKeys.push(key);
}
}
var removed = [];
var added = [];
for (key in keyMap) {
if (keyMap[key] < 0) {
this.removeKey(key);
removed.push(key);
}
if (keyMap[key] > 0) {
added.push(key);
}
}
return [{
removed: removed,
added: added
}];
}
};
Polymer.Collection.get = function (userArray) {
return Polymer._collections.get(userArray) || new Polymer.Collection(userArray);
};
Polymer.Collection.applySplices = function (userArray, splices) {
var coll = Polymer._collections.get(userArray);
return coll ? coll._applySplices(splices) : null;
};
Polymer({
is: 'dom-repeat',
extends: 'template',
_template: null,
properties: {
items: { type: Array },
as: {
type: String,
value: 'item'
},
indexAs: {
type: String,
value: 'index'
},
sort: {
type: Function,
observer: '_sortChanged'
},
filter: {
type: Function,
observer: '_filterChanged'
},
observe: {
type: String,
observer: '_observeChanged'
},
delay: Number,
renderedItemCount: {
type: Number,
notify: true,
readOnly: true
},
initialCount: {
type: Number,
observer: '_initializeChunking'
},
targetFramerate: {
type: Number,
value: 20
},
_targetFrameTime: {
type: Number,
computed: '_computeFrameTime(targetFramerate)'
}
},
behaviors: [Polymer.Templatizer],
observers: ['_itemsChanged(items.*)'],
created: function () {
this._instances = [];
this._pool = [];
this._limit = Infinity;
var self = this;
this._boundRenderChunk = function () {
self._renderChunk();
};
},
detached: function () {
this.__isDetached = true;
for (var i = 0; i < this._instances.length; i++) {
this._detachInstance(i);
}
},
attached: function () {
if (this.__isDetached) {
this.__isDetached = false;
var parent = Polymer.dom(Polymer.dom(this).parentNode);
for (var i = 0; i < this._instances.length; i++) {
this._attachInstance(i, parent);
}
}
},
ready: function () {
this._instanceProps = { __key__: true };
this._instanceProps[this.as] = true;
this._instanceProps[this.indexAs] = true;
if (!this.ctor) {
this.templatize(this);
}
},
_sortChanged: function (sort) {
var dataHost = this._getRootDataHost();
this._sortFn = sort && (typeof sort == 'function' ? sort : function () {
return dataHost[sort].apply(dataHost, arguments);
});
this._needFullRefresh = true;
if (this.items) {
this._debounceTemplate(this._render);
}
},
_filterChanged: function (filter) {
var dataHost = this._getRootDataHost();
this._filterFn = filter && (typeof filter == 'function' ? filter : function () {
return dataHost[filter].apply(dataHost, arguments);
});
this._needFullRefresh = true;
if (this.items) {
this._debounceTemplate(this._render);
}
},
_computeFrameTime: function (rate) {
return Math.ceil(1000 / rate);
},
_initializeChunking: function () {
if (this.initialCount) {
this._limit = this.initialCount;
this._chunkCount = this.initialCount;
this._lastChunkTime = performance.now();
}
},
_tryRenderChunk: function () {
if (this.items && this._limit < this.items.length) {
this.debounce('renderChunk', this._requestRenderChunk);
}
},
_requestRenderChunk: function () {
requestAnimationFrame(this._boundRenderChunk);
},
_renderChunk: function () {
var currChunkTime = performance.now();
var ratio = this._targetFrameTime / (currChunkTime - this._lastChunkTime);
this._chunkCount = Math.round(this._chunkCount * ratio) || 1;
this._limit += this._chunkCount;
this._lastChunkTime = currChunkTime;
this._debounceTemplate(this._render);
},
_observeChanged: function () {
this._observePaths = this.observe && this.observe.replace('.*', '.').split(' ');
},
_itemsChanged: function (change) {
if (change.path == 'items') {
if (Array.isArray(this.items)) {
this.collection = Polymer.Collection.get(this.items);
} else if (!this.items) {
this.collection = null;
} else {
this._error(this._logf('dom-repeat', 'expected array for `items`,' + ' found', this.items));
}
this._keySplices = [];
this._indexSplices = [];
this._needFullRefresh = true;
this._initializeChunking();
this._debounceTemplate(this._render);
} else if (change.path == 'items.splices') {
this._keySplices = this._keySplices.concat(change.value.keySplices);
this._indexSplices = this._indexSplices.concat(change.value.indexSplices);
this._debounceTemplate(this._render);
} else {
var subpath = change.path.slice(6);
this._forwardItemPath(subpath, change.value);
this._checkObservedPaths(subpath);
}
},
_checkObservedPaths: function (path) {
if (this._observePaths) {
path = path.substring(path.indexOf('.') + 1);
var paths = this._observePaths;
for (var i = 0; i < paths.length; i++) {
if (path.indexOf(paths[i]) === 0) {
this._needFullRefresh = true;
if (this.delay) {
this.debounce('render', this._render, this.delay);
} else {
this._debounceTemplate(this._render);
}
return;
}
}
}
},
render: function () {
this._needFullRefresh = true;
this._debounceTemplate(this._render);
this._flushTemplates();
},
_render: function () {
if (this._needFullRefresh) {
this._applyFullRefresh();
this._needFullRefresh = false;
} else if (this._keySplices.length) {
if (this._sortFn) {
this._applySplicesUserSort(this._keySplices);
} else {
if (this._filterFn) {
this._applyFullRefresh();
} else {
this._applySplicesArrayOrder(this._indexSplices);
}
}
} else {
}
this._keySplices = [];
this._indexSplices = [];
var keyToIdx = this._keyToInstIdx = {};
for (var i = this._instances.length - 1; i >= 0; i--) {
var inst = this._instances[i];
if (inst.isPlaceholder && i < this._limit) {
inst = this._insertInstance(i, inst.__key__);
} else if (!inst.isPlaceholder && i >= this._limit) {
inst = this._downgradeInstance(i, inst.__key__);
}
keyToIdx[inst.__key__] = i;
if (!inst.isPlaceholder) {
inst.__setProperty(this.indexAs, i, true);
}
}
this._pool.length = 0;
this._setRenderedItemCount(this._instances.length);
this.fire('dom-change');
this._tryRenderChunk();
},
_applyFullRefresh: function () {
var c = this.collection;
var keys;
if (this._sortFn) {
keys = c ? c.getKeys() : [];
} else {
keys = [];
var items = this.items;
if (items) {
for (var i = 0; i < items.length; i++) {
keys.push(c.getKey(items[i]));
}
}
}
var self = this;
if (this._filterFn) {
keys = keys.filter(function (a) {
return self._filterFn(c.getItem(a));
});
}
if (this._sortFn) {
keys.sort(function (a, b) {
return self._sortFn(c.getItem(a), c.getItem(b));
});
}
for (i = 0; i < keys.length; i++) {
var key = keys[i];
var inst = this._instances[i];
if (inst) {
inst.__key__ = key;
if (!inst.isPlaceholder && i < this._limit) {
inst.__setProperty(this.as, c.getItem(key), true);
}
} else if (i < this._limit) {
this._insertInstance(i, key);
} else {
this._insertPlaceholder(i, key);
}
}
for (var j = this._instances.length - 1; j >= i; j--) {
this._detachAndRemoveInstance(j);
}
},
_numericSort: function (a, b) {
return a - b;
},
_applySplicesUserSort: function (splices) {
var c = this.collection;
var keyMap = {};
var key;
for (var i = 0, s; i < splices.length && (s = splices[i]); i++) {
for (var j = 0; j < s.removed.length; j++) {
key = s.removed[j];
keyMap[key] = keyMap[key] ? null : -1;
}
for (j = 0; j < s.added.length; j++) {
key = s.added[j];
keyMap[key] = keyMap[key] ? null : 1;
}
}
var removedIdxs = [];
var addedKeys = [];
for (key in keyMap) {
if (keyMap[key] === -1) {
removedIdxs.push(this._keyToInstIdx[key]);
}
if (keyMap[key] === 1) {
addedKeys.push(key);
}
}
if (removedIdxs.length) {
removedIdxs.sort(this._numericSort);
for (i = removedIdxs.length - 1; i >= 0; i--) {
var idx = removedIdxs[i];
if (idx !== undefined) {
this._detachAndRemoveInstance(idx);
}
}
}
var self = this;
if (addedKeys.length) {
if (this._filterFn) {
addedKeys = addedKeys.filter(function (a) {
return self._filterFn(c.getItem(a));
});
}
addedKeys.sort(function (a, b) {
return self._sortFn(c.getItem(a), c.getItem(b));
});
var start = 0;
for (i = 0; i < addedKeys.length; i++) {
start = this._insertRowUserSort(start, addedKeys[i]);
}
}
},
_insertRowUserSort: function (start, key) {
var c = this.collection;
var item = c.getItem(key);
var end = this._instances.length - 1;
var idx = -1;
while (start <= end) {
var mid = start + end >> 1;
var midKey = this._instances[mid].__key__;
var cmp = this._sortFn(c.getItem(midKey), item);
if (cmp < 0) {
start = mid + 1;
} else if (cmp > 0) {
end = mid - 1;
} else {
idx = mid;
break;
}
}
if (idx < 0) {
idx = end + 1;
}
this._insertPlaceholder(idx, key);
return idx;
},
_applySplicesArrayOrder: function (splices) {
for (var i = 0, s; i < splices.length && (s = splices[i]); i++) {
for (var j = 0; j < s.removed.length; j++) {
this._detachAndRemoveInstance(s.index);
}
for (j = 0; j < s.addedKeys.length; j++) {
this._insertPlaceholder(s.index + j, s.addedKeys[j]);
}
}
},
_detachInstance: function (idx) {
var inst = this._instances[idx];
if (!inst.isPlaceholder) {
for (var i = 0; i < inst._children.length; i++) {
var el = inst._children[i];
Polymer.dom(inst.root).appendChild(el);
}
return inst;
}
},
_attachInstance: function (idx, parent) {
var inst = this._instances[idx];
if (!inst.isPlaceholder) {
parent.insertBefore(inst.root, this);
}
},
_detachAndRemoveInstance: function (idx) {
var inst = this._detachInstance(idx);
if (inst) {
this._pool.push(inst);
}
this._instances.splice(idx, 1);
},
_insertPlaceholder: function (idx, key) {
this._instances.splice(idx, 0, {
isPlaceholder: true,
__key__: key
});
},
_stampInstance: function (idx, key) {
var model = { __key__: key };
model[this.as] = this.collection.getItem(key);
model[this.indexAs] = idx;
return this.stamp(model);
},
_insertInstance: function (idx, key) {
var inst = this._pool.pop();
if (inst) {
inst.__setProperty(this.as, this.collection.getItem(key), true);
inst.__setProperty('__key__', key, true);
} else {
inst = this._stampInstance(idx, key);
}
var beforeRow = this._instances[idx + 1];
var beforeNode = beforeRow && !beforeRow.isPlaceholder ? beforeRow._children[0] : this;
var parentNode = Polymer.dom(this).parentNode;
Polymer.dom(parentNode).insertBefore(inst.root, beforeNode);
this._instances[idx] = inst;
return inst;
},
_downgradeInstance: function (idx, key) {
var inst = this._detachInstance(idx);
if (inst) {
this._pool.push(inst);
}
inst = {
isPlaceholder: true,
__key__: key
};
this._instances[idx] = inst;
return inst;
},
_showHideChildren: function (hidden) {
for (var i = 0; i < this._instances.length; i++) {
this._instances[i]._showHideChildren(hidden);
}
},
_forwardInstanceProp: function (inst, prop, value) {
if (prop == this.as) {
var idx;
if (this._sortFn || this._filterFn) {
idx = this.items.indexOf(this.collection.getItem(inst.__key__));
} else {
idx = inst[this.indexAs];
}
this.set('items.' + idx, value);
}
},
_forwardInstancePath: function (inst, path, value) {
if (path.indexOf(this.as + '.') === 0) {
this._notifyPath('items.' + inst.__key__ + '.' + path.slice(this.as.length + 1), value);
}
},
_forwardParentProp: function (prop, value) {
var i$ = this._instances;
for (var i = 0, inst; i < i$.length && (inst = i$[i]); i++) {
if (!inst.isPlaceholder) {
inst.__setProperty(prop, value, true);
}
}
},
_forwardParentPath: function (path, value) {
var i$ = this._instances;
for (var i = 0, inst; i < i$.length && (inst = i$[i]); i++) {
if (!inst.isPlaceholder) {
inst._notifyPath(path, value, true);
}
}
},
_forwardItemPath: function (path, value) {
if (this._keyToInstIdx) {
var dot = path.indexOf('.');
var key = path.substring(0, dot < 0 ? path.length : dot);
var idx = this._keyToInstIdx[key];
var inst = this._instances[idx];
if (inst && !inst.isPlaceholder) {
if (dot >= 0) {
path = this.as + '.' + path.substring(dot + 1);
inst._notifyPath(path, value, true);
} else {
inst.__setProperty(this.as, value, true);
}
}
}
},
itemForElement: function (el) {
var instance = this.modelForElement(el);
return instance && instance[this.as];
},
keyForElement: function (el) {
var instance = this.modelForElement(el);
return instance && instance.__key__;
},
indexForElement: function (el) {
var instance = this.modelForElement(el);
return instance && instance[this.indexAs];
}
});
Polymer({
is: 'array-selector',
_template: null,
properties: {
items: {
type: Array,
observer: 'clearSelection'
},
multi: {
type: Boolean,
value: false,
observer: 'clearSelection'
},
selected: {
type: Object,
notify: true
},
selectedItem: {
type: Object,
notify: true
},
toggle: {
type: Boolean,
value: false
}
},
clearSelection: function () {
if (Array.isArray(this.selected)) {
for (var i = 0; i < this.selected.length; i++) {
this.unlinkPaths('selected.' + i);
}
} else {
this.unlinkPaths('selected');
this.unlinkPaths('selectedItem');
}
if (this.multi) {
if (!this.selected || this.selected.length) {
this.selected = [];
this._selectedColl = Polymer.Collection.get(this.selected);
}
} else {
this.selected = null;
this._selectedColl = null;
}
this.selectedItem = null;
},
isSelected: function (item) {
if (this.multi) {
return this._selectedColl.getKey(item) !== undefined;
} else {
return this.selected == item;
}
},
deselect: function (item) {
if (this.multi) {
if (this.isSelected(item)) {
var skey = this._selectedColl.getKey(item);
this.arrayDelete('selected', item);
this.unlinkPaths('selected.' + skey);
}
} else {
this.selected = null;
this.selectedItem = null;
this.unlinkPaths('selected');
this.unlinkPaths('selectedItem');
}
},
select: function (item) {
var icol = Polymer.Collection.get(this.items);
var key = icol.getKey(item);
if (this.multi) {
if (this.isSelected(item)) {
if (this.toggle) {
this.deselect(item);
}
} else {
this.push('selected', item);
var skey = this._selectedColl.getKey(item);
this.linkPaths('selected.' + skey, 'items.' + key);
}
} else {
if (this.toggle && item == this.selected) {
this.deselect();
} else {
this.selected = item;
this.selectedItem = item;
this.linkPaths('selected', 'items.' + key);
this.linkPaths('selectedItem', 'items.' + key);
}
}
}
});
Polymer({
is: 'dom-if',
extends: 'template',
_template: null,
properties: {
'if': {
type: Boolean,
value: false,
observer: '_queueRender'
},
restamp: {
type: Boolean,
value: false,
observer: '_queueRender'
}
},
behaviors: [Polymer.Templatizer],
_queueRender: function () {
this._debounceTemplate(this._render);
},
detached: function () {
if (!this.parentNode || this.parentNode.nodeType == Node.DOCUMENT_FRAGMENT_NODE && (!Polymer.Settings.hasShadow || !(this.parentNode instanceof ShadowRoot))) {
this._teardownInstance();
}
},
attached: function () {
if (this.if && this.ctor) {
this.async(this._ensureInstance);
}
},
render: function () {
this._flushTemplates();
},
_render: function () {
if (this.if) {
if (!this.ctor) {
this.templatize(this);
}
this._ensureInstance();
this._showHideChildren();
} else if (this.restamp) {
this._teardownInstance();
}
if (!this.restamp && this._instance) {
this._showHideChildren();
}
if (this.if != this._lastIf) {
this.fire('dom-change');
this._lastIf = this.if;
}
},
_ensureInstance: function () {
var parentNode = Polymer.dom(this).parentNode;
if (parentNode) {
var parent = Polymer.dom(parentNode);
if (!this._instance) {
this._instance = this.stamp();
var root = this._instance.root;
parent.insertBefore(root, this);
} else {
var c$ = this._instance._children;
if (c$ && c$.length) {
var lastChild = Polymer.dom(this).previousSibling;
if (lastChild !== c$[c$.length - 1]) {
for (var i = 0, n; i < c$.length && (n = c$[i]); i++) {
parent.insertBefore(n, this);
}
}
}
}
}
},
_teardownInstance: function () {
if (this._instance) {
var c$ = this._instance._children;
if (c$ && c$.length) {
var parent = Polymer.dom(Polymer.dom(c$[0]).parentNode);
for (var i = 0, n; i < c$.length && (n = c$[i]); i++) {
parent.removeChild(n);
}
}
this._instance = null;
}
},
_showHideChildren: function () {
var hidden = this.__hideTemplateChildren__ || !this.if;
if (this._instance) {
this._instance._showHideChildren(hidden);
}
},
_forwardParentProp: function (prop, value) {
if (this._instance) {
this._instance[prop] = value;
}
},
_forwardParentPath: function (path, value) {
if (this._instance) {
this._instance._notifyPath(path, value, true);
}
}
});
Polymer({
is: 'dom-bind',
extends: 'template',
_template: null,
created: function () {
var self = this;
Polymer.RenderStatus.whenReady(function () {
if (document.readyState == 'loading') {
document.addEventListener('DOMContentLoaded', function () {
self._markImportsReady();
});
} else {
self._markImportsReady();
}
});
},
_ensureReady: function () {
if (!this._readied) {
this._readySelf();
}
},
_markImportsReady: function () {
this._importsReady = true;
this._ensureReady();
},
_registerFeatures: function () {
this._prepConstructor();
},
_insertChildren: function () {
var parentDom = Polymer.dom(Polymer.dom(this).parentNode);
parentDom.insertBefore(this.root, this);
},
_removeChildren: function () {
if (this._children) {
for (var i = 0; i < this._children.length; i++) {
this.root.appendChild(this._children[i]);
}
}
},
_initFeatures: function () {
},
_scopeElementClass: function (element, selector) {
if (this.dataHost) {
return this.dataHost._scopeElementClass(element, selector);
} else {
return selector;
}
},
_prepConfigure: function () {
var config = {};
for (var prop in this._propertyEffects) {
config[prop] = this[prop];
}
var setupConfigure = this._setupConfigure;
this._setupConfigure = function () {
setupConfigure.call(this, config);
};
},
attached: function () {
if (this._importsReady) {
this.render();
}
},
detached: function () {
this._removeChildren();
},
render: function () {
this._ensureReady();
if (!this._children) {
this._template = this;
this._prepAnnotations();
this._prepEffects();
this._prepBehaviors();
this._prepConfigure();
this._prepBindings();
this._prepPropertyInfo();
Polymer.Base._initFeatures.call(this);
this._children = Polymer.TreeApi.arrayCopyChildNodes(this.root);
}
this._insertChildren();
this.fire('dom-change');
}
});
(function () {
var metaDatas = {};
var metaArrays = {};
var singleton = null;
Polymer.IronMeta = Polymer({
is: 'iron-meta',
properties: {
type: {
type: String,
value: 'default',
observer: '_typeChanged'
},
key: {
type: String,
observer: '_keyChanged'
},
value: {
type: Object,
notify: true,
observer: '_valueChanged'
},
self: {
type: Boolean,
observer: '_selfChanged'
},
list: {
type: Array,
notify: true
}
},
hostAttributes: { hidden: true },
factoryImpl: function (config) {
if (config) {
for (var n in config) {
switch (n) {
case 'type':
case 'key':
case 'value':
this[n] = config[n];
break;
}
}
}
},
created: function () {
this._metaDatas = metaDatas;
this._metaArrays = metaArrays;
},
_keyChanged: function (key, old) {
this._resetRegistration(old);
},
_valueChanged: function (value) {
this._resetRegistration(this.key);
},
_selfChanged: function (self) {
if (self) {
this.value = this;
}
},
_typeChanged: function (type) {
this._unregisterKey(this.key);
if (!metaDatas[type]) {
metaDatas[type] = {};
}
this._metaData = metaDatas[type];
if (!metaArrays[type]) {
metaArrays[type] = [];
}
this.list = metaArrays[type];
this._registerKeyValue(this.key, this.value);
},
byKey: function (key) {
return this._metaData && this._metaData[key];
},
_resetRegistration: function (oldKey) {
this._unregisterKey(oldKey);
this._registerKeyValue(this.key, this.value);
},
_unregisterKey: function (key) {
this._unregister(key, this._metaData, this.list);
},
_registerKeyValue: function (key, value) {
this._register(key, value, this._metaData, this.list);
},
_register: function (key, value, data, list) {
if (key && data && value !== undefined) {
data[key] = value;
list.push(value);
}
},
_unregister: function (key, data, list) {
if (key && data) {
if (key in data) {
var value = data[key];
delete data[key];
this.arrayDelete(list, value);
}
}
}
});
Polymer.IronMeta.getIronMeta = function getIronMeta() {
if (singleton === null) {
singleton = new Polymer.IronMeta();
}
return singleton;
};
Polymer.IronMetaQuery = Polymer({
is: 'iron-meta-query',
properties: {
type: {
type: String,
value: 'default',
observer: '_typeChanged'
},
key: {
type: String,
observer: '_keyChanged'
},
value: {
type: Object,
notify: true,
readOnly: true
},
list: {
type: Array,
notify: true
}
},
factoryImpl: function (config) {
if (config) {
for (var n in config) {
switch (n) {
case 'type':
case 'key':
this[n] = config[n];
break;
}
}
}
},
created: function () {
this._metaDatas = metaDatas;
this._metaArrays = metaArrays;
},
_keyChanged: function (key) {
this._setValue(this._metaData && this._metaData[key]);
},
_typeChanged: function (type) {
this._metaData = metaDatas[type];
this.list = metaArrays[type];
if (this.key) {
this._keyChanged(this.key);
}
},
byKey: function (key) {
return this._metaData && this._metaData[key];
}
});
}());
Polymer({
is: 'iron-icon',
properties: {
icon: {
type: String,
observer: '_iconChanged'
},
theme: {
type: String,
observer: '_updateIcon'
},
src: {
type: String,
observer: '_srcChanged'
},
_meta: {
value: Polymer.Base.create('iron-meta', { type: 'iconset' }),
observer: '_updateIcon'
}
},
_DEFAULT_ICONSET: 'icons',
_iconChanged: function (icon) {
var parts = (icon || '').split(':');
this._iconName = parts.pop();
this._iconsetName = parts.pop() || this._DEFAULT_ICONSET;
this._updateIcon();
},
_srcChanged: function (src) {
this._updateIcon();
},
_usesIconset: function () {
return this.icon || !this.src;
},
_updateIcon: function () {
if (this._usesIconset()) {
if (this._img && this._img.parentNode) {
Polymer.dom(this.root).removeChild(this._img);
}
if (this._iconName === '') {
if (this._iconset) {
this._iconset.removeIcon(this);
}
} else if (this._iconsetName && this._meta) {
this._iconset = this._meta.byKey(this._iconsetName);
if (this._iconset) {
this._iconset.applyIcon(this, this._iconName, this.theme);
this.unlisten(window, 'iron-iconset-added', '_updateIcon');
} else {
this.listen(window, 'iron-iconset-added', '_updateIcon');
}
}
} else {
if (this._iconset) {
this._iconset.removeIcon(this);
}
if (!this._img) {
this._img = document.createElement('img');
this._img.style.width = '100%';
this._img.style.height = '100%';
this._img.draggable = false;
}
this._img.src = this.src;
Polymer.dom(this.root).appendChild(this._img);
}
}
});
Polymer({
is: 'iron-iconset-svg',
properties: {
name: {
type: String,
observer: '_nameChanged'
},
size: {
type: Number,
value: 24
}
},
attached: function () {
this.style.display = 'none';
},
getIconNames: function () {
this._icons = this._createIconMap();
return Object.keys(this._icons).map(function (n) {
return this.name + ':' + n;
}, this);
},
applyIcon: function (element, iconName) {
element = element.root || element;
this.removeIcon(element);
var svg = this._cloneIcon(iconName);
if (svg) {
var pde = Polymer.dom(element);
pde.insertBefore(svg, pde.childNodes[0]);
return element._svgIcon = svg;
}
return null;
},
removeIcon: function (element) {
if (element._svgIcon) {
Polymer.dom(element).removeChild(element._svgIcon);
element._svgIcon = null;
}
},
_nameChanged: function () {
new Polymer.IronMeta({
type: 'iconset',
key: this.name,
value: this
});
this.async(function () {
this.fire('iron-iconset-added', this, { node: window });
});
},
_createIconMap: function () {
var icons = Object.create(null);
Polymer.dom(this).querySelectorAll('[id]').forEach(function (icon) {
icons[icon.id] = icon;
});
return icons;
},
_cloneIcon: function (id) {
this._icons = this._icons || this._createIconMap();
return this._prepareSvgClone(this._icons[id], this.size);
},
_prepareSvgClone: function (sourceSvg, size) {
if (sourceSvg) {
var content = sourceSvg.cloneNode(true), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), viewBox = content.getAttribute('viewBox') || '0 0 ' + size + ' ' + size;
svg.setAttribute('viewBox', viewBox);
svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
svg.style.cssText = 'pointer-events: none; display: block; width: 100%; height: 100%;';
svg.appendChild(content).removeAttribute('id');
return svg;
}
return null;
}
});
Polymer({
is: 'px-icon',
properties: {
icon: { type: String },
color: {
type: String,
observer: '_handleColor'
},
size: {
type: Number,
observer: '_handleSize'
}
},
attached: function () {
},
_handleColor: function (newVal, oldVal) {
if (newVal) {
this.$.icn.style.fill = newVal;
}
},
_handleSize: function (newVal, oldVal) {
if (newVal) {
this.$.icn.style.width = newVal;
this.$.icn.style.height = newVal;
console.log('Updating icon size', newVal);
}
}
});
Polymer({
is: 'px-button',
properties: {
label: { type: String },
icon: { type: String },
iconSize: { type: String },
iconColor: { type: String },
modifier: {
type: String,
notify: true,
reflectToAttribute: true,
observer: '_handleModifier'
}
},
_clickHandler: function (e) {
this.fire('px-button-tap', e);
},
_handleModifier: function (newVal, oldVal) {
var types;
var klass = 'btn--' + oldVal;
this.toggleClass(klass, false, this.$.btn);
types = newVal.split(' ');
for (var i = 0; i < types.length; i++) {
klass = 'btn--' + types[i];
this.toggleClass(klass, true, this.$.btn);
}
}
});
Polymer({
is: 'px-brand',
properties: {
color: {
type: String,
value: 'white'
},
size: {
type: Number,
value: 32
},
monogram: { type: Boolean },
halo: {
type: Boolean,
value: false
},
haloWordmark: {
type: Boolean,
value: false
},
wordmark: {
type: Boolean,
value: false
}
}
});
Polymer({
is: 'px-footer',
properties: {
copywrite: {
type: String,
value: '2016 General Electric'
},
links: {
type: Array,
value: [
{
href: 'http://www.ge.com/privacy',
title: 'Privacy'
},
{
href: 'http://www.ge.com/terms',
title: 'Terms'
},
{
href: 'http://www.ge.com/access',
title: 'Accessibility'
}
]
}
}
});
Polymer.IronSelection = function (selectCallback) {
this.selection = [];
this.selectCallback = selectCallback;
};
Polymer.IronSelection.prototype = {
get: function () {
return this.multi ? this.selection.slice() : this.selection[0];
},
clear: function (excludes) {
this.selection.slice().forEach(function (item) {
if (!excludes || excludes.indexOf(item) < 0) {
this.setItemSelected(item, false);
}
}, this);
},
isSelected: function (item) {
return this.selection.indexOf(item) >= 0;
},
setItemSelected: function (item, isSelected) {
if (item != null) {
if (isSelected !== this.isSelected(item)) {
if (isSelected) {
this.selection.push(item);
} else {
var i = this.selection.indexOf(item);
if (i >= 0) {
this.selection.splice(i, 1);
}
}
if (this.selectCallback) {
this.selectCallback(item, isSelected);
}
}
}
},
select: function (item) {
if (this.multi) {
this.toggle(item);
} else if (this.get() !== item) {
this.setItemSelected(this.get(), false);
this.setItemSelected(item, true);
}
},
toggle: function (item) {
this.setItemSelected(item, !this.isSelected(item));
}
};
Polymer.IronSelectableBehavior = {
properties: {
attrForSelected: {
type: String,
value: null
},
selected: {
type: String,
notify: true
},
selectedItem: {
type: Object,
readOnly: true,
notify: true
},
activateEvent: {
type: String,
value: 'tap',
observer: '_activateEventChanged'
},
selectable: String,
selectedClass: {
type: String,
value: 'iron-selected'
},
selectedAttribute: {
type: String,
value: null
},
fallbackSelection: {
type: String,
value: null
},
items: {
type: Array,
readOnly: true,
notify: true,
value: function () {
return [];
}
},
_excludedLocalNames: {
type: Object,
value: function () {
return { 'template': 1 };
}
}
},
observers: [
'_updateAttrForSelected(attrForSelected)',
'_updateSelected(selected)',
'_checkFallback(fallbackSelection)'
],
created: function () {
this._bindFilterItem = this._filterItem.bind(this);
this._selection = new Polymer.IronSelection(this._applySelection.bind(this));
},
attached: function () {
this._observer = this._observeItems(this);
this._updateItems();
if (!this._shouldUpdateSelection) {
this._updateSelected();
}
this._addListener(this.activateEvent);
},
detached: function () {
if (this._observer) {
Polymer.dom(this).unobserveNodes(this._observer);
}
this._removeListener(this.activateEvent);
},
indexOf: function (item) {
return this.items.indexOf(item);
},
select: function (value) {
this.selected = value;
},
selectPrevious: function () {
var length = this.items.length;
var index = (Number(this._valueToIndex(this.selected)) - 1 + length) % length;
this.selected = this._indexToValue(index);
},
selectNext: function () {
var index = (Number(this._valueToIndex(this.selected)) + 1) % this.items.length;
this.selected = this._indexToValue(index);
},
selectIndex: function (index) {
this.select(this._indexToValue(index));
},
forceSynchronousItemUpdate: function () {
this._updateItems();
},
get _shouldUpdateSelection() {
return this.selected != null;
},
_checkFallback: function () {
if (this._shouldUpdateSelection) {
this._updateSelected();
}
},
_addListener: function (eventName) {
this.listen(this, eventName, '_activateHandler');
},
_removeListener: function (eventName) {
this.unlisten(this, eventName, '_activateHandler');
},
_activateEventChanged: function (eventName, old) {
this._removeListener(old);
this._addListener(eventName);
},
_updateItems: function () {
var nodes = Polymer.dom(this).queryDistributedElements(this.selectable || '*');
nodes = Array.prototype.filter.call(nodes, this._bindFilterItem);
this._setItems(nodes);
},
_updateAttrForSelected: function () {
if (this._shouldUpdateSelection) {
this.selected = this._indexToValue(this.indexOf(this.selectedItem));
}
},
_updateSelected: function () {
this._selectSelected(this.selected);
},
_selectSelected: function (selected) {
this._selection.select(this._valueToItem(this.selected));
if (this.fallbackSelection && this.items.length && this._selection.get() === undefined) {
this.selected = this.fallbackSelection;
}
},
_filterItem: function (node) {
return !this._excludedLocalNames[node.localName];
},
_valueToItem: function (value) {
return value == null ? null : this.items[this._valueToIndex(value)];
},
_valueToIndex: function (value) {
if (this.attrForSelected) {
for (var i = 0, item; item = this.items[i]; i++) {
if (this._valueForItem(item) == value) {
return i;
}
}
} else {
return Number(value);
}
},
_indexToValue: function (index) {
if (this.attrForSelected) {
var item = this.items[index];
if (item) {
return this._valueForItem(item);
}
} else {
return index;
}
},
_valueForItem: function (item) {
var propValue = item[Polymer.CaseMap.dashToCamelCase(this.attrForSelected)];
return propValue != undefined ? propValue : item.getAttribute(this.attrForSelected);
},
_applySelection: function (item, isSelected) {
if (this.selectedClass) {
this.toggleClass(this.selectedClass, isSelected, item);
}
if (this.selectedAttribute) {
this.toggleAttribute(this.selectedAttribute, isSelected, item);
}
this._selectionChange();
this.fire('iron-' + (isSelected ? 'select' : 'deselect'), { item: item });
},
_selectionChange: function () {
this._setSelectedItem(this._selection.get());
},
_observeItems: function (node) {
return Polymer.dom(node).observeNodes(function (mutation) {
this._updateItems();
if (this._shouldUpdateSelection) {
this._updateSelected();
}
this.fire('iron-items-changed', mutation, {
bubbles: false,
cancelable: false
});
});
},
_activateHandler: function (e) {
var t = e.target;
var items = this.items;
while (t && t != this) {
var i = items.indexOf(t);
if (i >= 0) {
var value = this._indexToValue(i);
this._itemActivate(value, t);
return;
}
t = t.parentNode;
}
},
_itemActivate: function (value, item) {
if (!this.fire('iron-activate', {
selected: value,
item: item
}, { cancelable: true }).defaultPrevented) {
this.select(value);
}
}
};
Polymer.IronMultiSelectableBehaviorImpl = {
properties: {
multi: {
type: Boolean,
value: false,
observer: 'multiChanged'
},
selectedValues: {
type: Array,
notify: true
},
selectedItems: {
type: Array,
readOnly: true,
notify: true
}
},
observers: ['_updateSelected(selectedValues.splices)'],
select: function (value) {
if (this.multi) {
if (this.selectedValues) {
this._toggleSelected(value);
} else {
this.selectedValues = [value];
}
} else {
this.selected = value;
}
},
multiChanged: function (multi) {
this._selection.multi = multi;
},
get _shouldUpdateSelection() {
return this.selected != null || this.selectedValues != null && this.selectedValues.length;
},
_updateAttrForSelected: function () {
if (!this.multi) {
Polymer.IronSelectableBehavior._updateAttrForSelected.apply(this);
} else if (this._shouldUpdateSelection) {
this.selectedValues = this.selectedItems.map(function (selectedItem) {
return this._indexToValue(this.indexOf(selectedItem));
}, this).filter(function (unfilteredValue) {
return unfilteredValue != null;
}, this);
}
},
_updateSelected: function () {
if (this.multi) {
this._selectMulti(this.selectedValues);
} else {
this._selectSelected(this.selected);
}
},
_selectMulti: function (values) {
if (values) {
var selectedItems = this._valuesToItems(values);
this._selection.clear(selectedItems);
for (var i = 0; i < selectedItems.length; i++) {
this._selection.setItemSelected(selectedItems[i], true);
}
if (this.fallbackSelection && this.items.length && !this._selection.get().length) {
var fallback = this._valueToItem(this.fallbackSelection);
if (fallback) {
this.selectedValues = [this.fallbackSelection];
}
}
} else {
this._selection.clear();
}
},
_selectionChange: function () {
var s = this._selection.get();
if (this.multi) {
this._setSelectedItems(s);
} else {
this._setSelectedItems([s]);
this._setSelectedItem(s);
}
},
_toggleSelected: function (value) {
var i = this.selectedValues.indexOf(value);
var unselected = i < 0;
if (unselected) {
this.push('selectedValues', value);
} else {
this.splice('selectedValues', i, 1);
}
},
_valuesToItems: function (values) {
return values == null ? null : values.map(function (value) {
return this._valueToItem(value);
}, this);
}
};
Polymer.IronMultiSelectableBehavior = [
Polymer.IronSelectableBehavior,
Polymer.IronMultiSelectableBehaviorImpl
];
Polymer({
is: 'iron-selector',
behaviors: [Polymer.IronMultiSelectableBehavior]
});
Polymer({
is: 'px-header',
hostAttributes: { role: 'header' },
properties: {
title: {
type: String,
value: 'Seed Application'
},
subtitle: { type: String },
powered: { type: String },
username: { type: String },
navItems: { type: Array },
selected: {
type: Number,
notify: true
}
},
_handleTap: function (e) {
this.fire('px-header-link-select', e);
},
_handleUserTap: function (e) {
this.fire('px-header-user-select', e);
}
});
Polymer({
is: 'px-title-bar',
properties: { title: { type: String } },
created: function () {
}
});
Polymer({
is: 'px-navbar',
properties: {
subtitle: { type: String },
title: { type: String },
sidebarContainer: { type: String },
viewContainer: {
type: String,
notify: true,
reflectToAttribute: true
},
fixed: {
type: Boolean,
value: false
},
open: {
type: Boolean,
notify: true,
observer: '_openChanged',
value: false
},
menu: {
type: Boolean,
value: false
},
views: {
type: Object,
value: {}
},
back: {
type: Boolean,
value: false,
reflectToAttribute: true
},
backLabel: {
type: String,
value: 'Back'
},
theme: {
type: String,
value: 'white',
notify: true,
observer: '_themeChanged',
reflectToAttribute: true
}
},
ready: function () {
if (this.theme) {
this.toggleClass('navbar--' + this.theme, true, Polymer.dom(this.root).querySelector('.navbar'));
}
if (this.fixed) {
this.toggleClass('navbar--fixed', true, Polymer.dom(this.root).querySelector('.navbar'));
}
},
attached: function () {
var _this = this;
if (_this.sidebarContainer) {
_this.sidebar = document.getElementById(_this.sidebarContainer);
_this.sidebar.addEventListener('toggle', function () {
_this.toggleClass('px-sidebar-open', _this.sidebar.open);
});
}
var parent = this.parentNode;
if (parent && parent.localName === 'px-page') {
this.theme = parent.attr('theme');
this.title = parent.attr('title');
if (parent.viewContainer) {
_this.viewContainer = parent.viewContainer.id;
_this.views = document.getElementById(_this.viewContainer);
_this.menu = _this.views.getCurrent().main;
console.log('parentViewContainer', parent.viewContainer);
}
}
if (this.viewContainer) {
this.debounce('initViews', function () {
_this.views = document.getElementById(_this.viewContainer);
_this.menu = _this.views.getCurrent().main;
_this.views.addEventListener('change', function (e) {
console.log('Page changed', e);
_this.debounce('change', function () {
_this.title = e.detail.title;
_this.menu = _this.views.getCurrent().main;
_this.back = _this.views.getCurrent().main ? false : true;
_this.backLabel = _this.views.prevView ? _this.views.prevView.title : '';
}, 50);
console.warn('Add back button to previous page', _this.back);
});
}, 150);
}
this._fixButtons();
},
toggleMenu: function () {
return this.fire('px-toggle-menu', this);
},
toggleSidebar: function (open) {
if (this.sidebar && this.sidebar.toggle) {
this.sidebar.toggle();
if (this.viewContainer && this.views) {
this.views.toggleClass('px-sidebar-open');
}
}
this.fire('sidebar:toggle');
},
_handleMenuClick: function (e) {
if (this.sidebar && this.sidebar.toggle) {
this.sidebar.toggle();
}
this.fire('menu:click', e);
},
_handleBackClick: function () {
if (this.parentNode && this.parentNode.viewContainer) {
this.parentNode.viewContainer.back();
}
if (this.viewContainer && this.views) {
this.views.back();
}
this.fire('back');
},
_handleViewChange: function () {
if (this.viewContainer && this.views) {
this.back = this.views.getCurrent() !== this.views.main;
}
},
toggle: function (display) {
this.hidden = !this.hidden;
this.toggleClass('hidden', this.hidden);
},
getCurrent: function () {
if (this.viewContainer && this.views) {
return this.views.getCurrent();
}
},
_registerOffclick: function () {
this.views.addEventListener('click', this.toggleMenu);
},
_deregisterOffclick: function () {
this.views.removeEventListener('click', this.toggleMenu);
},
_openChanged: function (newVal, oldVal) {
var _this = this;
if (_this.sidebar && _this.sidebar.toggle) {
this.debounce('openSidebar', function () {
_this.sidebar.toggle(newVal);
}, 100);
}
},
_themeChanged: function (newVal, oldVal) {
var _this = this;
this.async(function () {
if (oldVal) {
_this.toggleClass('navbar--' + oldVal, false, _this.$$('.navbar'));
}
_this.toggleClass('navbar--' + newVal, true, _this.$$('.navbar'));
});
},
_fixButtons: function () {
this.queryAllEffectiveChildren('button').forEach(function (b) {
if (b && b.toggleClass) {
b.toggleClass('navbar__button');
}
});
}
});
Polymer.IronResizableBehavior = {
properties: {
_parentResizable: {
type: Object,
observer: '_parentResizableChanged'
},
_notifyingDescendant: {
type: Boolean,
value: false
}
},
listeners: { 'iron-request-resize-notifications': '_onIronRequestResizeNotifications' },
created: function () {
this._interestedResizables = [];
this._boundNotifyResize = this.notifyResize.bind(this);
},
attached: function () {
this.fire('iron-request-resize-notifications', null, {
node: this,
bubbles: true,
cancelable: true
});
if (!this._parentResizable) {
window.addEventListener('resize', this._boundNotifyResize);
this.notifyResize();
}
},
detached: function () {
if (this._parentResizable) {
this._parentResizable.stopResizeNotificationsFor(this);
} else {
window.removeEventListener('resize', this._boundNotifyResize);
}
this._parentResizable = null;
},
notifyResize: function () {
if (!this.isAttached) {
return;
}
this._interestedResizables.forEach(function (resizable) {
if (this.resizerShouldNotify(resizable)) {
this._notifyDescendant(resizable);
}
}, this);
this._fireResize();
},
assignParentResizable: function (parentResizable) {
this._parentResizable = parentResizable;
},
stopResizeNotificationsFor: function (target) {
var index = this._interestedResizables.indexOf(target);
if (index > -1) {
this._interestedResizables.splice(index, 1);
this.unlisten(target, 'iron-resize', '_onDescendantIronResize');
}
},
resizerShouldNotify: function (element) {
return true;
},
_onDescendantIronResize: function (event) {
if (this._notifyingDescendant) {
event.stopPropagation();
return;
}
if (!Polymer.Settings.useShadow) {
this._fireResize();
}
},
_fireResize: function () {
this.fire('iron-resize', null, {
node: this,
bubbles: false
});
},
_onIronRequestResizeNotifications: function (event) {
var target = event.path ? event.path[0] : event.target;
if (target === this) {
return;
}
if (this._interestedResizables.indexOf(target) === -1) {
this._interestedResizables.push(target);
this.listen(target, 'iron-resize', '_onDescendantIronResize');
}
target.assignParentResizable(this);
this._notifyDescendant(target);
event.stopPropagation();
},
_parentResizableChanged: function (parentResizable) {
if (parentResizable) {
window.removeEventListener('resize', this._boundNotifyResize);
}
},
_notifyDescendant: function (descendant) {
if (!this.isAttached) {
return;
}
this._notifyingDescendant = true;
descendant.notifyResize();
this._notifyingDescendant = false;
}
};
Polymer.IronFitBehavior = {
properties: {
sizingTarget: {
type: Object,
value: function () {
return this;
}
},
fitInto: {
type: Object,
value: window
},
noOverlap: { type: Boolean },
positionTarget: { type: Element },
horizontalAlign: { type: String },
verticalAlign: { type: String },
dynamicAlign: { type: Boolean },
horizontalOffset: {
type: Number,
value: 0,
notify: true
},
verticalOffset: {
type: Number,
value: 0,
notify: true
},
autoFitOnAttach: {
type: Boolean,
value: false
},
_fitInfo: { type: Object }
},
get _fitWidth() {
var fitWidth;
if (this.fitInto === window) {
fitWidth = this.fitInto.innerWidth;
} else {
fitWidth = this.fitInto.getBoundingClientRect().width;
}
return fitWidth;
},
get _fitHeight() {
var fitHeight;
if (this.fitInto === window) {
fitHeight = this.fitInto.innerHeight;
} else {
fitHeight = this.fitInto.getBoundingClientRect().height;
}
return fitHeight;
},
get _fitLeft() {
var fitLeft;
if (this.fitInto === window) {
fitLeft = 0;
} else {
fitLeft = this.fitInto.getBoundingClientRect().left;
}
return fitLeft;
},
get _fitTop() {
var fitTop;
if (this.fitInto === window) {
fitTop = 0;
} else {
fitTop = this.fitInto.getBoundingClientRect().top;
}
return fitTop;
},
get _defaultPositionTarget() {
var parent = Polymer.dom(this).parentNode;
if (parent && parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
parent = parent.host;
}
return parent;
},
get _localeHorizontalAlign() {
if (this._isRTL) {
if (this.horizontalAlign === 'right') {
return 'left';
}
if (this.horizontalAlign === 'left') {
return 'right';
}
}
return this.horizontalAlign;
},
attached: function () {
this._isRTL = window.getComputedStyle(this).direction == 'rtl';
this.positionTarget = this.positionTarget || this._defaultPositionTarget;
if (this.autoFitOnAttach) {
if (window.getComputedStyle(this).display === 'none') {
setTimeout(function () {
this.fit();
}.bind(this));
} else {
this.fit();
}
}
},
fit: function () {
this._discoverInfo();
this.position();
this.constrain();
this.center();
},
_discoverInfo: function () {
if (this._fitInfo) {
return;
}
var target = window.getComputedStyle(this);
var sizer = window.getComputedStyle(this.sizingTarget);
this._fitInfo = {
inlineStyle: {
top: this.style.top || '',
left: this.style.left || '',
position: this.style.position || ''
},
sizerInlineStyle: {
maxWidth: this.sizingTarget.style.maxWidth || '',
maxHeight: this.sizingTarget.style.maxHeight || '',
boxSizing: this.sizingTarget.style.boxSizing || ''
},
positionedBy: {
vertically: target.top !== 'auto' ? 'top' : target.bottom !== 'auto' ? 'bottom' : null,
horizontally: target.left !== 'auto' ? 'left' : target.right !== 'auto' ? 'right' : null
},
sizedBy: {
height: sizer.maxHeight !== 'none',
width: sizer.maxWidth !== 'none',
minWidth: parseInt(sizer.minWidth, 10) || 0,
minHeight: parseInt(sizer.minHeight, 10) || 0
},
margin: {
top: parseInt(target.marginTop, 10) || 0,
right: parseInt(target.marginRight, 10) || 0,
bottom: parseInt(target.marginBottom, 10) || 0,
left: parseInt(target.marginLeft, 10) || 0
}
};
if (this.verticalOffset) {
this._fitInfo.margin.top = this._fitInfo.margin.bottom = this.verticalOffset;
this._fitInfo.inlineStyle.marginTop = this.style.marginTop || '';
this._fitInfo.inlineStyle.marginBottom = this.style.marginBottom || '';
this.style.marginTop = this.style.marginBottom = this.verticalOffset + 'px';
}
if (this.horizontalOffset) {
this._fitInfo.margin.left = this._fitInfo.margin.right = this.horizontalOffset;
this._fitInfo.inlineStyle.marginLeft = this.style.marginLeft || '';
this._fitInfo.inlineStyle.marginRight = this.style.marginRight || '';
this.style.marginLeft = this.style.marginRight = this.horizontalOffset + 'px';
}
},
resetFit: function () {
var info = this._fitInfo || {};
for (var property in info.sizerInlineStyle) {
this.sizingTarget.style[property] = info.sizerInlineStyle[property];
}
for (var property in info.inlineStyle) {
this.style[property] = info.inlineStyle[property];
}
this._fitInfo = null;
},
refit: function () {
var scrollLeft = this.sizingTarget.scrollLeft;
var scrollTop = this.sizingTarget.scrollTop;
this.resetFit();
this.fit();
this.sizingTarget.scrollLeft = scrollLeft;
this.sizingTarget.scrollTop = scrollTop;
},
position: function () {
if (!this.horizontalAlign && !this.verticalAlign) {
return;
}
this.style.position = 'fixed';
this.sizingTarget.style.boxSizing = 'border-box';
this.style.left = '0px';
this.style.top = '0px';
var rect = this.getBoundingClientRect();
var positionRect = this.__getNormalizedRect(this.positionTarget);
var fitRect = this.__getNormalizedRect(this.fitInto);
var margin = this._fitInfo.margin;
var size = {
width: rect.width + margin.left + margin.right,
height: rect.height + margin.top + margin.bottom
};
var position = this.__getPosition(this._localeHorizontalAlign, this.verticalAlign, size, positionRect, fitRect);
var left = position.left + margin.left;
var top = position.top + margin.top;
var right = Math.min(fitRect.right - margin.right, left + rect.width);
var bottom = Math.min(fitRect.bottom - margin.bottom, top + rect.height);
var minWidth = this._fitInfo.sizedBy.minWidth;
var minHeight = this._fitInfo.sizedBy.minHeight;
if (left < margin.left) {
left = margin.left;
if (right - left < minWidth) {
left = right - minWidth;
}
}
if (top < margin.top) {
top = margin.top;
if (bottom - top < minHeight) {
top = bottom - minHeight;
}
}
this.sizingTarget.style.maxWidth = right - left + 'px';
this.sizingTarget.style.maxHeight = bottom - top + 'px';
this.style.left = left - rect.left + 'px';
this.style.top = top - rect.top + 'px';
},
constrain: function () {
if (this.horizontalAlign || this.verticalAlign) {
return;
}
var info = this._fitInfo;
if (!info.positionedBy.vertically) {
this.style.position = 'fixed';
this.style.top = '0px';
}
if (!info.positionedBy.horizontally) {
this.style.position = 'fixed';
this.style.left = '0px';
}
this.sizingTarget.style.boxSizing = 'border-box';
var rect = this.getBoundingClientRect();
if (!info.sizedBy.height) {
this.__sizeDimension(rect, info.positionedBy.vertically, 'top', 'bottom', 'Height');
}
if (!info.sizedBy.width) {
this.__sizeDimension(rect, info.positionedBy.horizontally, 'left', 'right', 'Width');
}
},
_sizeDimension: function (rect, positionedBy, start, end, extent) {
this.__sizeDimension(rect, positionedBy, start, end, extent);
},
__sizeDimension: function (rect, positionedBy, start, end, extent) {
var info = this._fitInfo;
var fitRect = this.__getNormalizedRect(this.fitInto);
var max = extent === 'Width' ? fitRect.width : fitRect.height;
var flip = positionedBy === end;
var offset = flip ? max - rect[end] : rect[start];
var margin = info.margin[flip ? start : end];
var offsetExtent = 'offset' + extent;
var sizingOffset = this[offsetExtent] - this.sizingTarget[offsetExtent];
this.sizingTarget.style['max' + extent] = max - margin - offset - sizingOffset + 'px';
},
center: function () {
if (this.horizontalAlign || this.verticalAlign) {
return;
}
var positionedBy = this._fitInfo.positionedBy;
if (positionedBy.vertically && positionedBy.horizontally) {
return;
}
this.style.position = 'fixed';
if (!positionedBy.vertically) {
this.style.top = '0px';
}
if (!positionedBy.horizontally) {
this.style.left = '0px';
}
var rect = this.getBoundingClientRect();
var fitRect = this.__getNormalizedRect(this.fitInto);
if (!positionedBy.vertically) {
var top = fitRect.top - rect.top + (fitRect.height - rect.height) / 2;
this.style.top = top + 'px';
}
if (!positionedBy.horizontally) {
var left = fitRect.left - rect.left + (fitRect.width - rect.width) / 2;
this.style.left = left + 'px';
}
},
__getNormalizedRect: function (target) {
if (target === document.documentElement || target === window) {
return {
top: 0,
left: 0,
width: window.innerWidth,
height: window.innerHeight,
right: window.innerWidth,
bottom: window.innerHeight
};
}
return target.getBoundingClientRect();
},
__getCroppedArea: function (position, size, fitRect) {
var verticalCrop = Math.min(0, position.top) + Math.min(0, fitRect.bottom - (position.top + size.height));
var horizontalCrop = Math.min(0, position.left) + Math.min(0, fitRect.right - (position.left + size.width));
return Math.abs(verticalCrop) * size.width + Math.abs(horizontalCrop) * size.height;
},
__getPosition: function (hAlign, vAlign, size, positionRect, fitRect) {
var positions = [
{
verticalAlign: 'top',
horizontalAlign: 'left',
top: positionRect.top,
left: positionRect.left
},
{
verticalAlign: 'top',
horizontalAlign: 'right',
top: positionRect.top,
left: positionRect.right - size.width
},
{
verticalAlign: 'bottom',
horizontalAlign: 'left',
top: positionRect.bottom - size.height,
left: positionRect.left
},
{
verticalAlign: 'bottom',
horizontalAlign: 'right',
top: positionRect.bottom - size.height,
left: positionRect.right - size.width
}
];
if (this.noOverlap) {
for (var i = 0, l = positions.length; i < l; i++) {
var copy = {};
for (var key in positions[i]) {
copy[key] = positions[i][key];
}
positions.push(copy);
}
positions[0].top = positions[1].top += positionRect.height;
positions[2].top = positions[3].top -= positionRect.height;
positions[4].left = positions[6].left += positionRect.width;
positions[5].left = positions[7].left -= positionRect.width;
}
vAlign = vAlign === 'auto' ? null : vAlign;
hAlign = hAlign === 'auto' ? null : hAlign;
var position;
for (var i = 0; i < positions.length; i++) {
var pos = positions[i];
if (!this.dynamicAlign && !this.noOverlap && pos.verticalAlign === vAlign && pos.horizontalAlign === hAlign) {
position = pos;
break;
}
var alignOk = (!vAlign || pos.verticalAlign === vAlign) && (!hAlign || pos.horizontalAlign === hAlign);
if (!this.dynamicAlign && !alignOk) {
continue;
}
position = position || pos;
pos.croppedArea = this.__getCroppedArea(pos, size, fitRect);
var diff = pos.croppedArea - position.croppedArea;
if (diff < 0 || diff === 0 && alignOk) {
position = pos;
}
if (position.croppedArea === 0 && alignOk) {
break;
}
}
return position;
}
};
Polymer({
is: 'px-drawer',
behaviors: [
Polymer.IronResizableBehavior,
Polymer.IronFitBehavior
],
properties: {
opened: {
type: Boolean,
value: false,
notify: true,
reflectToAttribute: true,
observer: '_openHandler'
},
persistent: {
type: Boolean,
value: false,
reflectToAttribute: true
},
fixed: {
type: Boolean,
value: false
},
mini: {
type: Boolean,
value: false
},
overlay: { type: Boolean },
theme: {
type: String,
reflectToAttribute: true
},
align: {
type: String,
reflectToAttribute: true,
value: 'left',
observer: '_typeHandler'
},
type: {
type: String,
value: 'temporary',
reflectToAttribute: true,
observer: '_typeHandler'
},
swipeOpen: {
type: Boolean,
value: true,
reflectToAttribute: true
},
modifier: {
type: String,
notify: true,
reflectToAttribute: true,
observer: '_handleModifier'
}
},
listeners: {
'drawer.track': '_handleTrack',
'overlay.tap': 'toggle',
'drawerContent.tap': 'toggle',
'iron-resize': '_resizeHandler'
},
observers: ['resetLayout(fixed)'],
_boundEscKeydownHandler: null,
ready: function () {
this.setScrollDirection('y');
},
attached: function () {
Polymer.RenderStatus.afterNextRender(this, function () {
});
this._init();
},
_init: function () {
document.addEventListener('keydown', this._escKeydownHandler.bind(this));
this.toggleClass('drawer--' + this.align, true, this.$.drawer);
if (this.theme) {
this.toggleClass('drawer--' + this.theme, true, this.$.drawer);
}
if (this.fixed) {
this.toggleClass('drawer--fixed', true, this.$.drawer);
}
if (this.persistent) {
this.toggleClass('drawer--temporary', true, this.$.drawer);
this.toggleClass('drawer--persistent', true, this.$.drawer);
}
this.debounce('resetLayout', function () {
this.fire('px-drawer-layout-reset');
}, 350);
},
detached: function () {
if (this._boundEscKeydownHandler) {
document.removeEventListener('keydown', this._boundEscKeydownHandler);
}
},
toggle: function (type) {
if (this.type === 'temporary' || this.type === 'mini') {
this.opened = !this.opened;
this.fire('px-drawer-toggle', this.opened);
}
},
_startX: 0,
_startY: 0,
_dist: 0,
_threshold: 80,
_allowedTime: 400,
_restraint: 100,
_startTime: 0,
_handleTrack: function (e) {
e.preventDefault();
switch (e.detail.state) {
case 'start':
this._handleTrackStart(e);
break;
case 'end':
this._handleTrackEnd(e);
break;
default:
}
},
_swipeDir: null,
_handleTrackStart: function (e) {
e.preventDefault();
var touchobj = e.detail;
this._swipeDir = 'none';
this._startX = touchobj.sourceEvent.pageX, this._startY = touchobj.sourceEvent.pageY;
this._startTime = new Date().getTime();
this._dist = 0;
},
_handleTrackEnd: function (e) {
e.preventDefault();
var swipedir = null;
var touchobj = e.detail.sourceEvent;
var allowedTime = this._allowedTime;
var startY = this._startY;
var startX = this._startX;
var restraint = this._restraint;
var startTime = this._startTime;
var threshold = this._threshold;
var distX = touchobj.pageX - startX;
var distY = touchobj.pageY - startY;
var elapsedTime = new Date().getTime() - startTime;
if (elapsedTime <= allowedTime) {
if (Math.abs(distX) >= threshold && Math.abs(distY) <= restraint) {
swipedir = distX < 0 ? 'left' : 'right';
} else if (Math.abs(distY) >= threshold && Math.abs(distX) <= restraint) {
swipedir = distY < 0 ? 'up' : 'down';
}
}
this._handleTrackComplete(swipedir);
},
_handleTrackComplete: function (swipedir) {
console.warn('swipeComplete', swipedir);
switch (swipedir) {
case 'up':
if (this.align === 'bottom') {
this.open();
}
break;
case 'down':
if (this.align === 'bottom') {
this.close();
}
break;
case 'left':
if (this.align === 'left') {
this.close();
}
break;
case 'right':
this.open();
break;
}
},
_handlePan: function (e) {
this._moveDrawer(e.deltaX);
switch (e.type) {
case 'panup':
if (this.align === 'bottom') {
this.open();
}
break;
case 'pandown':
if (this.align === 'bottom') {
this.close();
}
break;
case 'panleft':
if (this.align === 'left') {
this.close();
}
break;
case 'panright':
this.open();
break;
}
},
_handleOffClick: function (e) {
if (this.opened) {
this.close();
}
},
_openHandler: function (newVal, oldVal) {
this.toggleClass('is-open', newVal, this.$.drawer);
this.toggleClass('is-open', newVal, this.$.overlay);
},
_typeHandler: function (newVal, oldVal) {
this.toggleClass('drawer--' + oldVal, false, this.$.drawer);
this.toggleClass('drawer--' + newVal, true, this.$.drawer);
if (this.persistent) {
}
},
_handleModifier: function (newVal, oldVal) {
var _this = this, klass, types;
klass = 'drawer--' + oldVal;
_this.toggleClass(klass, false, _this.$.drawer);
if (_this.modifier) {
types = _this.modifier.split(' ');
for (var i = 0; i < types.length; i++) {
klass = 'drawer--' + types[i];
_this.toggleClass(klass, true, _this.$.drawer);
}
}
},
getWidth: function () {
return this.$.drawerContent.offsetWidth;
},
open: function () {
if (!this.persistent) {
this.opened = true;
this.fire('px-drawer-open', this);
}
},
close: function () {
if (!this.persistent) {
this.opened = false;
this.fire('px-drawer-close', this);
}
},
_escKeydownHandler: function (event) {
var ESC_KEYCODE = 27;
if (event.keyCode === ESC_KEYCODE && !this.persistent) {
event.preventDefault();
this.close();
}
},
resetLayout: function () {
this.debounce('_resetLayout', function () {
this.fire('px-drawer-reset-layout', this);
}, 1);
},
_resizeHandler: function () {
},
_moveDrawer: function (translateX) {
var _content = this.$.drawer;
this.toggleClass('transition', this._transition, _content);
this.toggleClass('dragging', this._dragging, _content);
},
_transformForTranslateX: function (translateX) {
if (translateX === null) {
return 'translate3d(0, 0, 0)';
}
return 'translate3d(' + translateX + 'px, 0, 0)';
}
});
Polymer({
is: 'px-media-query',
properties: {
queryMatches: {
type: Boolean,
value: false,
readOnly: true,
notify: true
},
query: {
type: String,
observer: 'queryChanged'
},
namedQueries: {
type: Object,
value: {
xs: '(max-width: 21.33rem)',
sm: '(min-width: 22rem) and (max-width: 49.06rem)',
md: '(min-width: 51.2rem) and (max-width: 68.2rem)',
lg: '(min-width: 68.26rem) and (max-width: 80rem)',
xl: '(min-width: 85.33rem)'
}
},
full: {
type: Boolean,
value: false
},
_boundMQHandler: {
value: function () {
return this.queryHandler.bind(this);
}
},
_mq: { value: null }
},
attached: function () {
this.style.display = 'none';
this.queryChanged();
},
detached: function () {
this._remove();
},
_add: function () {
if (this._mq) {
this._mq.addListener(this._boundMQHandler);
}
},
_remove: function () {
if (this._mq) {
this._mq.removeListener(this._boundMQHandler);
}
this._mq = null;
},
queryChanged: function () {
this._remove();
var query = this.query;
if (this.namedQueries[query]) {
query = this.namedQueries[query];
}
if (!query) {
return;
}
if (!this.full && query[0] !== '(') {
query = '(' + query + ')';
}
this._mq = window.matchMedia(query);
this._add();
this.queryHandler(this._mq);
},
queryHandler: function (mq) {
this.fire('px-media-query-change', mq);
this._setQueryMatches(mq.matches);
}
});
Polymer({
is: 'px-layout-item',
properties: {},
created: function () {
},
ready: function () {
},
attached: function () {
},
detached: function () {
}
});
Polymer({
is: 'px-layout',
properties: {
type: {
type: String,
value: 'full'
},
navItems: { type: Array },
options: {
type: Object,
observer: '_handleOptions',
value: {
primarySidebar: {
open: false,
align: 'left',
type: 'temporary'
},
secondarySidebar: {
open: false,
align: 'right',
type: 'temporary'
}
}
},
forceNarrow: {
type: Boolean,
value: false
},
responsiveWidth: {
type: String,
value: '49.06rem'
},
narrow: {
type: Boolean,
readOnly: true,
notify: true
}
},
listeners: { 'tap': '_tapHandler' },
_tapHandler: function (e) {
var target = Polymer.dom(e).localTarget;
if (target && target.hasAttribute('secondary-sidebar-toggle') || target && target.parentElement.hasAttribute('secondary-sidebar-toggle')) {
this.$.secondarySidebar.toggle();
}
if (target && target.hasAttribute('primary-sidebar-toggle') || target && target.parentElement.hasAttribute('primary-sidebar-toggle')) {
this.$.primarySidebar.toggle();
}
},
attached: function () {
this.toggleClass('l-container--' + this.type, true, this.$$('.l-container__wrapper'));
var hasNavbar = this.$$('.navbar');
if (hasNavbar) {
}
this.$.primarySidebar.addEventListener('toggle', this._sidebarToggleHandler.bind(this));
if (this.type === 'progressive') {
this.$.primarySidebar.type = 'static';
this.$.secondarySidebar.type = 'static';
}
},
detached: function () {
this.$.primarySidebar.removeEventListener('toggle', this._sidebarToggleHandler.bind(this));
},
toggle: function (name, options) {
var el = this.$[name];
if (el && el.toggle) {
el.toggle();
}
},
_sidebarToggleHandler: function (e) {
var sidebarWidth = e.target.offsetWidth;
if (e.target.open) {
sidebarWidth = e.target.offsetWidth;
} else {
sidebarWidth = 0;
}
if (this.options.primarySidebar.reveal === 'push') {
this.transform('translateX(' + sidebarWidth + 'px)', this.$$('.l-container__wrapper'));
}
},
toggleContent: function (name) {
},
_setElementOptions: function (options) {
var self = this;
var key, value, o, el;
if (options) {
for (var k in options) {
el = self.$[k];
value = options[k];
}
}
},
_handleOptions: function (newVal, oldVal) {
this._setElementOptions(this.options);
},
_onQueryMatchesChanged: function (event) {
this.fire('px-media-query', event.detail.value);
this._setNarrow(event.detail.value);
},
_computeMediaQuery: function (forceNarrow, responsiveWidth) {
return forceNarrow ? '(min-width: 0px)' : '(max-width: ' + responsiveWidth + ')';
}
});
Polymer({
is: 'px-header-layout',
behaviors: [Polymer.IronResizableBehavior],
properties: {
forceNarrow: {
type: Boolean,
value: false
},
responsiveWidth: {
type: String,
value: '425px'
},
narrow: {
type: Boolean,
readOnly: true,
notify: true
}
},
get header() {
return Polymer.dom(this.$.headerContent).getDistributedNodes()[0];
},
get footer() {
return Polymer.dom(this.$.footerContent).getDistributedNodes()[0];
},
get navbar() {
return Polymer.dom(this.$.navbarContent).getDistributedNodes()[0];
},
listeners: {},
observers: ['resetLayout(narrow, isAttached)'],
attached: function () {
this.async(function () {
if (this.navbar) {
this.toggleClass('has-navbar', true, this.$$('.l-header-layout__container'));
}
});
},
resetLayout: function () {
this.debounce('_resetLayout', function () {
if (!this.isAttached) {
console.warn('notAttached');
return;
}
this.notifyResize();
});
},
_onQueryMatchesChanged: function (event) {
this.fire('px-media-query', event.detail.value);
this._setNarrow(event.detail.value);
},
_computeMediaQuery: function (forceNarrow, responsiveWidth) {
return forceNarrow ? '(min-width: 0px)' : '(max-width: ' + responsiveWidth + ')';
}
});
Polymer({
is: 'px-drawer-layout',
behaviors: [Polymer.IronResizableBehavior],
hostAttributes: {},
properties: {
forceNarrow: {
type: Boolean,
value: false
},
responsiveWidth: {
type: String,
value: '768px'
},
narrow: {
type: Boolean,
reflectToAttribute: true,
readOnly: true
}
},
get drawer() {
return Polymer.dom(this.$.drawerContent).getDistributedNodes()[0];
},
get navbar() {
return Polymer.dom(this.$.navbarContent).getDistributedNodes()[0];
},
listeners: {
'tap': '_tapHandler',
'px-drawer-layout-reset': 'resetLayout'
},
observers: ['resetLayout(narrow, isAttached)'],
attached: function () {
this.async(function () {
this.toggleClass('has-navbar', this.navbar ? true : false, this.$.layoutContent);
if (this.drawer) {
this.drawer.fitInto = this.$.drawerContainer;
}
});
},
_tapHandler: function (e) {
var target = Polymer.dom(e).localTarget;
if (target && target.hasAttribute('drawer-toggle') || target && target.parentElement.hasAttribute('drawer-toggle')) {
if (!this.drawer.persistent) {
}
this.drawer.toggle();
}
},
resetLayout: function () {
this.debounce('_resetLayout', function () {
if (!this.isAttached) {
console.warn('notAttached');
return;
}
var drawer = this.drawer;
var drawerWidth = this.drawer.getWidth();
var contentContainer = this.$.contentContainer;
if (this.narrow) {
drawer.opened = drawer.persistent = false;
drawer.type = 'temporary';
contentContainer.classList.add('is-narrow');
contentContainer.style.marginLeft = '';
contentContainer.style.marginRight = '';
if (this.navbar && this.navbar.fixed) {
this.navbar.$$('.navbar').style.left = '';
}
} else {
drawer.opened = drawer.persistent = true;
drawer.type = 'persistent';
contentContainer.classList.remove('is-narrow');
if (this.navbar && this.navbar.fixed) {
this.navbar.$$('.navbar').style.left = drawerWidth + 'px';
}
if (drawer.align == 'right') {
contentContainer.style.marginLeft = '';
contentContainer.style.marginRight = drawerWidth + 'px';
} else {
contentContainer.style.marginLeft = drawerWidth + 'px';
contentContainer.style.marginRight = '';
}
}
this.toggleClass('is-narrow', this.narrow);
this.notifyResize();
});
},
_handleDrawerToggle: function () {
var drawer = this.drawer;
var drawerWidth = this.drawer.getWidth();
var contentContainer = this.$.contentContainer;
if (drawer && drawer.opened) {
if (drawer.align == 'right') {
contentContainer.style.marginLeft = '';
contentContainer.style.marginRight = drawerWidth + 'px';
} else {
contentContainer.style.marginLeft = drawerWidth + 'px';
contentContainer.style.marginRight = '';
}
} else {
contentContainer.style.marginLeft = '';
contentContainer.style.marginRight = '';
}
},
_onQueryMatchesChanged: function (event) {
this.fire('px-media-query', event.detail.value);
this._setNarrow(event.detail.value);
},
_computeMediaQuery: function (forceNarrow, responsiveWidth) {
return forceNarrow ? '(min-width: 0px)' : '(max-width: ' + responsiveWidth + ')';
},
_resizeHandler: function () {
this.debounce('_resetLayout', function () {
this.resetLayout();
}, 1);
}
});
(function () {
'use strict';
var KEY_IDENTIFIER = {
'U+0008': 'backspace',
'U+0009': 'tab',
'U+001B': 'esc',
'U+0020': 'space',
'U+007F': 'del'
};
var KEY_CODE = {
8: 'backspace',
9: 'tab',
13: 'enter',
27: 'esc',
33: 'pageup',
34: 'pagedown',
35: 'end',
36: 'home',
32: 'space',
37: 'left',
38: 'up',
39: 'right',
40: 'down',
46: 'del',
106: '*'
};
var MODIFIER_KEYS = {
'shift': 'shiftKey',
'ctrl': 'ctrlKey',
'alt': 'altKey',
'meta': 'metaKey'
};
var KEY_CHAR = /[a-z0-9*]/;
var IDENT_CHAR = /U\+/;
var ARROW_KEY = /^arrow/;
var SPACE_KEY = /^space(bar)?/;
var ESC_KEY = /^escape$/;
function transformKey(key, noSpecialChars) {
var validKey = '';
if (key) {
var lKey = key.toLowerCase();
if (lKey === ' ' || SPACE_KEY.test(lKey)) {
validKey = 'space';
} else if (ESC_KEY.test(lKey)) {
validKey = 'esc';
} else if (lKey.length == 1) {
if (!noSpecialChars || KEY_CHAR.test(lKey)) {
validKey = lKey;
}
} else if (ARROW_KEY.test(lKey)) {
validKey = lKey.replace('arrow', '');
} else if (lKey == 'multiply') {
validKey = '*';
} else {
validKey = lKey;
}
}
return validKey;
}
function transformKeyIdentifier(keyIdent) {
var validKey = '';
if (keyIdent) {
if (keyIdent in KEY_IDENTIFIER) {
validKey = KEY_IDENTIFIER[keyIdent];
} else if (IDENT_CHAR.test(keyIdent)) {
keyIdent = parseInt(keyIdent.replace('U+', '0x'), 16);
validKey = String.fromCharCode(keyIdent).toLowerCase();
} else {
validKey = keyIdent.toLowerCase();
}
}
return validKey;
}
function transformKeyCode(keyCode) {
var validKey = '';
if (Number(keyCode)) {
if (keyCode >= 65 && keyCode <= 90) {
validKey = String.fromCharCode(32 + keyCode);
} else if (keyCode >= 112 && keyCode <= 123) {
validKey = 'f' + (keyCode - 112);
} else if (keyCode >= 48 && keyCode <= 57) {
validKey = String(keyCode - 48);
} else if (keyCode >= 96 && keyCode <= 105) {
validKey = String(keyCode - 96);
} else {
validKey = KEY_CODE[keyCode];
}
}
return validKey;
}
function normalizedKeyForEvent(keyEvent, noSpecialChars) {
return transformKey(keyEvent.key, noSpecialChars) || transformKeyIdentifier(keyEvent.keyIdentifier) || transformKeyCode(keyEvent.keyCode) || transformKey(keyEvent.detail ? keyEvent.detail.key : keyEvent.detail, noSpecialChars) || '';
}
function keyComboMatchesEvent(keyCombo, event) {
var keyEvent = normalizedKeyForEvent(event, keyCombo.hasModifiers);
return keyEvent === keyCombo.key && (!keyCombo.hasModifiers || !!event.shiftKey === !!keyCombo.shiftKey && !!event.ctrlKey === !!keyCombo.ctrlKey && !!event.altKey === !!keyCombo.altKey && !!event.metaKey === !!keyCombo.metaKey);
}
function parseKeyComboString(keyComboString) {
if (keyComboString.length === 1) {
return {
combo: keyComboString,
key: keyComboString,
event: 'keydown'
};
}
return keyComboString.split('+').reduce(function (parsedKeyCombo, keyComboPart) {
var eventParts = keyComboPart.split(':');
var keyName = eventParts[0];
var event = eventParts[1];
if (keyName in MODIFIER_KEYS) {
parsedKeyCombo[MODIFIER_KEYS[keyName]] = true;
parsedKeyCombo.hasModifiers = true;
} else {
parsedKeyCombo.key = keyName;
parsedKeyCombo.event = event || 'keydown';
}
return parsedKeyCombo;
}, { combo: keyComboString.split(':').shift() });
}
function parseEventString(eventString) {
return eventString.trim().split(' ').map(function (keyComboString) {
return parseKeyComboString(keyComboString);
});
}
Polymer.IronA11yKeysBehavior = {
properties: {
keyEventTarget: {
type: Object,
value: function () {
return this;
}
},
stopKeyboardEventPropagation: {
type: Boolean,
value: false
},
_boundKeyHandlers: {
type: Array,
value: function () {
return [];
}
},
_imperativeKeyBindings: {
type: Object,
value: function () {
return {};
}
}
},
observers: ['_resetKeyEventListeners(keyEventTarget, _boundKeyHandlers)'],
keyBindings: {},
registered: function () {
this._prepKeyBindings();
},
attached: function () {
this._listenKeyEventListeners();
},
detached: function () {
this._unlistenKeyEventListeners();
},
addOwnKeyBinding: function (eventString, handlerName) {
this._imperativeKeyBindings[eventString] = handlerName;
this._prepKeyBindings();
this._resetKeyEventListeners();
},
removeOwnKeyBindings: function () {
this._imperativeKeyBindings = {};
this._prepKeyBindings();
this._resetKeyEventListeners();
},
keyboardEventMatchesKeys: function (event, eventString) {
var keyCombos = parseEventString(eventString);
for (var i = 0; i < keyCombos.length; ++i) {
if (keyComboMatchesEvent(keyCombos[i], event)) {
return true;
}
}
return false;
},
_collectKeyBindings: function () {
var keyBindings = this.behaviors.map(function (behavior) {
return behavior.keyBindings;
});
if (keyBindings.indexOf(this.keyBindings) === -1) {
keyBindings.push(this.keyBindings);
}
return keyBindings;
},
_prepKeyBindings: function () {
this._keyBindings = {};
this._collectKeyBindings().forEach(function (keyBindings) {
for (var eventString in keyBindings) {
this._addKeyBinding(eventString, keyBindings[eventString]);
}
}, this);
for (var eventString in this._imperativeKeyBindings) {
this._addKeyBinding(eventString, this._imperativeKeyBindings[eventString]);
}
for (var eventName in this._keyBindings) {
this._keyBindings[eventName].sort(function (kb1, kb2) {
var b1 = kb1[0].hasModifiers;
var b2 = kb2[0].hasModifiers;
return b1 === b2 ? 0 : b1 ? -1 : 1;
});
}
},
_addKeyBinding: function (eventString, handlerName) {
parseEventString(eventString).forEach(function (keyCombo) {
this._keyBindings[keyCombo.event] = this._keyBindings[keyCombo.event] || [];
this._keyBindings[keyCombo.event].push([
keyCombo,
handlerName
]);
}, this);
},
_resetKeyEventListeners: function () {
this._unlistenKeyEventListeners();
if (this.isAttached) {
this._listenKeyEventListeners();
}
},
_listenKeyEventListeners: function () {
if (!this.keyEventTarget) {
return;
}
Object.keys(this._keyBindings).forEach(function (eventName) {
var keyBindings = this._keyBindings[eventName];
var boundKeyHandler = this._onKeyBindingEvent.bind(this, keyBindings);
this._boundKeyHandlers.push([
this.keyEventTarget,
eventName,
boundKeyHandler
]);
this.keyEventTarget.addEventListener(eventName, boundKeyHandler);
}, this);
},
_unlistenKeyEventListeners: function () {
var keyHandlerTuple;
var keyEventTarget;
var eventName;
var boundKeyHandler;
while (this._boundKeyHandlers.length) {
keyHandlerTuple = this._boundKeyHandlers.pop();
keyEventTarget = keyHandlerTuple[0];
eventName = keyHandlerTuple[1];
boundKeyHandler = keyHandlerTuple[2];
keyEventTarget.removeEventListener(eventName, boundKeyHandler);
}
},
_onKeyBindingEvent: function (keyBindings, event) {
if (this.stopKeyboardEventPropagation) {
event.stopPropagation();
}
if (event.defaultPrevented) {
return;
}
for (var i = 0; i < keyBindings.length; i++) {
var keyCombo = keyBindings[i][0];
var handlerName = keyBindings[i][1];
if (keyComboMatchesEvent(keyCombo, event)) {
this._triggerKeyHandler(keyCombo, handlerName, event);
if (event.defaultPrevented) {
return;
}
}
}
},
_triggerKeyHandler: function (keyCombo, handlerName, keyboardEvent) {
var detail = Object.create(keyCombo);
detail.keyboardEvent = keyboardEvent;
var event = new CustomEvent(keyCombo.event, {
detail: detail,
cancelable: true
});
this[handlerName].call(this, event);
if (event.defaultPrevented) {
keyboardEvent.preventDefault();
}
}
};
}());
(function () {
'use strict';
Polymer({
is: 'iron-overlay-backdrop',
properties: {
opened: {
reflectToAttribute: true,
type: Boolean,
value: false,
observer: '_openedChanged'
}
},
listeners: { 'transitionend': '_onTransitionend' },
created: function () {
this.__openedRaf = null;
},
attached: function () {
this.opened && this._openedChanged(this.opened);
},
prepare: function () {
if (this.opened && !this.parentNode) {
Polymer.dom(document.body).appendChild(this);
}
},
open: function () {
this.opened = true;
},
close: function () {
this.opened = false;
},
complete: function () {
if (!this.opened && this.parentNode === document.body) {
Polymer.dom(this.parentNode).removeChild(this);
}
},
_onTransitionend: function (event) {
if (event && event.target === this) {
this.complete();
}
},
_openedChanged: function (opened) {
if (opened) {
this.prepare();
} else {
var cs = window.getComputedStyle(this);
if (cs.transitionDuration === '0s' || cs.opacity == 0) {
this.complete();
}
}
if (!this.isAttached) {
return;
}
if (this.__openedRaf) {
window.cancelAnimationFrame(this.__openedRaf);
this.__openedRaf = null;
}
this.scrollTop = this.scrollTop;
this.__openedRaf = window.requestAnimationFrame(function () {
this.__openedRaf = null;
this.toggleClass('opened', this.opened);
}.bind(this));
}
});
}());
Polymer.IronOverlayManagerClass = function () {
this._overlays = [];
this._minimumZ = 101;
this._backdropElement = null;
Polymer.Gestures.add(document, 'tap', null);
document.addEventListener('tap', this._onCaptureClick.bind(this), true);
document.addEventListener('focus', this._onCaptureFocus.bind(this), true);
document.addEventListener('keydown', this._onCaptureKeyDown.bind(this), true);
};
Polymer.IronOverlayManagerClass.prototype = {
constructor: Polymer.IronOverlayManagerClass,
get backdropElement() {
if (!this._backdropElement) {
this._backdropElement = document.createElement('iron-overlay-backdrop');
}
return this._backdropElement;
},
get deepActiveElement() {
var active = document.activeElement || document.body;
while (active.root && Polymer.dom(active.root).activeElement) {
active = Polymer.dom(active.root).activeElement;
}
return active;
},
_bringOverlayAtIndexToFront: function (i) {
var overlay = this._overlays[i];
if (!overlay) {
return;
}
var lastI = this._overlays.length - 1;
var currentOverlay = this._overlays[lastI];
if (currentOverlay && this._shouldBeBehindOverlay(overlay, currentOverlay)) {
lastI--;
}
if (i >= lastI) {
return;
}
var minimumZ = Math.max(this.currentOverlayZ(), this._minimumZ);
if (this._getZ(overlay) <= minimumZ) {
this._applyOverlayZ(overlay, minimumZ);
}
while (i < lastI) {
this._overlays[i] = this._overlays[i + 1];
i++;
}
this._overlays[lastI] = overlay;
},
addOrRemoveOverlay: function (overlay) {
if (overlay.opened) {
this.addOverlay(overlay);
} else {
this.removeOverlay(overlay);
}
},
addOverlay: function (overlay) {
var i = this._overlays.indexOf(overlay);
if (i >= 0) {
this._bringOverlayAtIndexToFront(i);
this.trackBackdrop();
return;
}
var insertionIndex = this._overlays.length;
var currentOverlay = this._overlays[insertionIndex - 1];
var minimumZ = Math.max(this._getZ(currentOverlay), this._minimumZ);
var newZ = this._getZ(overlay);
if (currentOverlay && this._shouldBeBehindOverlay(overlay, currentOverlay)) {
this._applyOverlayZ(currentOverlay, minimumZ);
insertionIndex--;
var previousOverlay = this._overlays[insertionIndex - 1];
minimumZ = Math.max(this._getZ(previousOverlay), this._minimumZ);
}
if (newZ <= minimumZ) {
this._applyOverlayZ(overlay, minimumZ);
}
this._overlays.splice(insertionIndex, 0, overlay);
var element = this.deepActiveElement;
overlay.restoreFocusNode = this._overlayParent(element) ? null : element;
this.trackBackdrop();
},
removeOverlay: function (overlay) {
var i = this._overlays.indexOf(overlay);
if (i === -1) {
return;
}
this._overlays.splice(i, 1);
var node = overlay.restoreFocusOnClose ? overlay.restoreFocusNode : null;
overlay.restoreFocusNode = null;
if (node && Polymer.dom(document.body).deepContains(node)) {
node.focus();
}
this.trackBackdrop();
},
currentOverlay: function () {
var i = this._overlays.length - 1;
return this._overlays[i];
},
currentOverlayZ: function () {
return this._getZ(this.currentOverlay());
},
ensureMinimumZ: function (minimumZ) {
this._minimumZ = Math.max(this._minimumZ, minimumZ);
},
focusOverlay: function () {
var current = this.currentOverlay();
if (current && !current.transitioning) {
current._applyFocus();
}
},
trackBackdrop: function () {
var overlay = this._overlayWithBackdrop();
if (!overlay && !this._backdropElement) {
return;
}
this.backdropElement.style.zIndex = this._getZ(overlay) - 1;
this.backdropElement.opened = !!overlay;
},
getBackdrops: function () {
var backdrops = [];
for (var i = 0; i < this._overlays.length; i++) {
if (this._overlays[i].withBackdrop) {
backdrops.push(this._overlays[i]);
}
}
return backdrops;
},
backdropZ: function () {
return this._getZ(this._overlayWithBackdrop()) - 1;
},
_overlayWithBackdrop: function () {
for (var i = 0; i < this._overlays.length; i++) {
if (this._overlays[i].withBackdrop) {
return this._overlays[i];
}
}
},
_getZ: function (overlay) {
var z = this._minimumZ;
if (overlay) {
var z1 = Number(overlay.style.zIndex || window.getComputedStyle(overlay).zIndex);
if (z1 === z1) {
z = z1;
}
}
return z;
},
_setZ: function (element, z) {
element.style.zIndex = z;
},
_applyOverlayZ: function (overlay, aboveZ) {
this._setZ(overlay, aboveZ + 2);
},
_overlayParent: function (node) {
while (node && node !== document.body) {
if (node._manager === this) {
return node;
}
node = Polymer.dom(node).parentNode || node.host;
}
},
_overlayInPath: function (path) {
path = path || [];
for (var i = 0; i < path.length; i++) {
if (path[i]._manager === this) {
return path[i];
}
}
},
_onCaptureClick: function (event) {
var overlay = this.currentOverlay();
if (overlay && this._overlayInPath(Polymer.dom(event).path) !== overlay) {
overlay._onCaptureClick(event);
}
},
_onCaptureFocus: function (event) {
var overlay = this.currentOverlay();
if (overlay) {
overlay._onCaptureFocus(event);
}
},
_onCaptureKeyDown: function (event) {
var overlay = this.currentOverlay();
if (overlay) {
if (Polymer.IronA11yKeysBehavior.keyboardEventMatchesKeys(event, 'esc')) {
overlay._onCaptureEsc(event);
} else if (Polymer.IronA11yKeysBehavior.keyboardEventMatchesKeys(event, 'tab')) {
overlay._onCaptureTab(event);
}
}
},
_shouldBeBehindOverlay: function (overlay1, overlay2) {
return !overlay1.alwaysOnTop && overlay2.alwaysOnTop;
}
};
Polymer.IronOverlayManager = new Polymer.IronOverlayManagerClass();
(function () {
'use strict';
Polymer.IronOverlayBehaviorImpl = {
properties: {
opened: {
observer: '_openedChanged',
type: Boolean,
value: false,
notify: true
},
canceled: {
observer: '_canceledChanged',
readOnly: true,
type: Boolean,
value: false
},
withBackdrop: {
observer: '_withBackdropChanged',
type: Boolean
},
noAutoFocus: {
type: Boolean,
value: false
},
noCancelOnEscKey: {
type: Boolean,
value: false
},
noCancelOnOutsideClick: {
type: Boolean,
value: false
},
closingReason: { type: Object },
restoreFocusOnClose: {
type: Boolean,
value: false
},
alwaysOnTop: { type: Boolean },
_manager: {
type: Object,
value: Polymer.IronOverlayManager
},
_focusedChild: { type: Object }
},
listeners: { 'iron-resize': '_onIronResize' },
get backdropElement() {
return this._manager.backdropElement;
},
get _focusNode() {
return this._focusedChild || Polymer.dom(this).querySelector('[autofocus]') || this;
},
get _focusableNodes() {
var FOCUSABLE_WITH_DISABLED = [
'a[href]',
'area[href]',
'iframe',
'[tabindex]',
'[contentEditable=true]'
];
var FOCUSABLE_WITHOUT_DISABLED = [
'input',
'select',
'textarea',
'button'
];
var selector = FOCUSABLE_WITH_DISABLED.join(':not([tabindex="-1"]),') + ':not([tabindex="-1"]),' + FOCUSABLE_WITHOUT_DISABLED.join(':not([disabled]):not([tabindex="-1"]),') + ':not([disabled]):not([tabindex="-1"])';
var focusables = Polymer.dom(this).querySelectorAll(selector);
if (this.tabIndex >= 0) {
focusables.splice(0, 0, this);
}
return focusables.sort(function (a, b) {
if (a.tabIndex === b.tabIndex) {
return 0;
}
if (a.tabIndex === 0 || a.tabIndex > b.tabIndex) {
return 1;
}
return -1;
});
},
ready: function () {
this.__isAnimating = false;
this.__shouldRemoveTabIndex = false;
this.__firstFocusableNode = this.__lastFocusableNode = null;
this.__openChangedAsync = null;
this.__onIronResizeAsync = null;
this._ensureSetup();
},
attached: function () {
if (this.opened) {
this._openedChanged();
}
this._observer = Polymer.dom(this).observeNodes(this._onNodesChange);
},
detached: function () {
Polymer.dom(this).unobserveNodes(this._observer);
this._observer = null;
this.opened = false;
},
toggle: function () {
this._setCanceled(false);
this.opened = !this.opened;
},
open: function () {
this._setCanceled(false);
this.opened = true;
},
close: function () {
this._setCanceled(false);
this.opened = false;
},
cancel: function (event) {
var cancelEvent = this.fire('iron-overlay-canceled', event, { cancelable: true });
if (cancelEvent.defaultPrevented) {
return;
}
this._setCanceled(true);
this.opened = false;
},
_ensureSetup: function () {
if (this._overlaySetup) {
return;
}
this._overlaySetup = true;
this.style.outline = 'none';
this.style.display = 'none';
},
_openedChanged: function () {
if (this.opened) {
this.removeAttribute('aria-hidden');
} else {
this.setAttribute('aria-hidden', 'true');
}
if (!this._overlaySetup) {
return;
}
if (this.__openChangedAsync) {
window.cancelAnimationFrame(this.__openChangedAsync);
}
if (!this.opened) {
this._manager.removeOverlay(this);
}
if (!this.isAttached) {
return;
}
this.__isAnimating = true;
this.__openChangedAsync = window.requestAnimationFrame(function () {
this.__openChangedAsync = null;
if (this.opened) {
this._manager.addOverlay(this);
this._prepareRenderOpened();
this._renderOpened();
} else {
this._renderClosed();
}
}.bind(this));
},
_canceledChanged: function () {
this.closingReason = this.closingReason || {};
this.closingReason.canceled = this.canceled;
},
_withBackdropChanged: function () {
if (this.withBackdrop && !this.hasAttribute('tabindex')) {
this.setAttribute('tabindex', '-1');
this.__shouldRemoveTabIndex = true;
} else if (this.__shouldRemoveTabIndex) {
this.removeAttribute('tabindex');
this.__shouldRemoveTabIndex = false;
}
if (this.opened && this.isAttached) {
this._manager.trackBackdrop();
}
},
_prepareRenderOpened: function () {
this._preparePositioning();
this.refit();
this._finishPositioning();
if (this.noAutoFocus && document.activeElement === this._focusNode) {
this._focusNode.blur();
}
},
_renderOpened: function () {
this._finishRenderOpened();
},
_renderClosed: function () {
this._finishRenderClosed();
},
_finishRenderOpened: function () {
this._applyFocus();
this.notifyResize();
this.__isAnimating = false;
var focusableNodes = this._focusableNodes;
this.__firstFocusableNode = focusableNodes[0];
this.__lastFocusableNode = focusableNodes[focusableNodes.length - 1];
this.fire('iron-overlay-opened');
},
_finishRenderClosed: function () {
this.style.display = 'none';
this.style.zIndex = '';
this._applyFocus();
this.notifyResize();
this.__isAnimating = false;
this.fire('iron-overlay-closed', this.closingReason);
},
_preparePositioning: function () {
this.style.transition = this.style.webkitTransition = 'none';
this.style.transform = this.style.webkitTransform = 'none';
this.style.display = '';
},
_finishPositioning: function () {
this.style.display = 'none';
this.scrollTop = this.scrollTop;
this.style.transition = this.style.webkitTransition = '';
this.style.transform = this.style.webkitTransform = '';
this.style.display = '';
this.scrollTop = this.scrollTop;
},
_applyFocus: function () {
if (this.opened) {
if (!this.noAutoFocus) {
this._focusNode.focus();
}
} else {
this._focusNode.blur();
this._focusedChild = null;
this._manager.focusOverlay();
}
},
_onCaptureClick: function (event) {
if (!this.noCancelOnOutsideClick) {
this.cancel(event);
}
},
_onCaptureFocus: function (event) {
if (!this.withBackdrop) {
return;
}
var path = Polymer.dom(event).path;
if (path.indexOf(this) === -1) {
event.stopPropagation();
this._applyFocus();
} else {
this._focusedChild = path[0];
}
},
_onCaptureEsc: function (event) {
if (!this.noCancelOnEscKey) {
this.cancel(event);
}
},
_onCaptureTab: function (event) {
if (!this.withBackdrop) {
return;
}
var shift = event.shiftKey;
var nodeToCheck = shift ? this.__firstFocusableNode : this.__lastFocusableNode;
var nodeToSet = shift ? this.__lastFocusableNode : this.__firstFocusableNode;
var shouldWrap = false;
if (nodeToCheck === nodeToSet) {
shouldWrap = true;
} else {
var focusedNode = this._manager.deepActiveElement;
shouldWrap = focusedNode === nodeToCheck || focusedNode === this;
}
if (shouldWrap) {
event.preventDefault();
this._focusedChild = nodeToSet;
this._applyFocus();
}
},
_onIronResize: function () {
if (this.__onIronResizeAsync) {
window.cancelAnimationFrame(this.__onIronResizeAsync);
this.__onIronResizeAsync = null;
}
if (this.opened && !this.__isAnimating) {
this.__onIronResizeAsync = window.requestAnimationFrame(function () {
this.__onIronResizeAsync = null;
this.refit();
}.bind(this));
}
},
_onNodesChange: function () {
if (this.opened && !this.__isAnimating) {
this.notifyResize();
}
}
};
Polymer.IronOverlayBehavior = [
Polymer.IronFitBehavior,
Polymer.IronResizableBehavior,
Polymer.IronOverlayBehaviorImpl
];
}());
Polymer({
is: 'px-action-sheet',
behaviors: [
Polymer.IronResizableBehavior,
Polymer.IronOverlayBehavior
],
properties: {
isopen: {
type: Boolean,
observer: '_openHandler',
value: false
},
modifier: {
type: String,
notify: true,
reflectToAttribute: true,
observer: '_handleModifier'
}
},
listeners: { 'iron-resize': '_resizeHandler' },
attached: function () {
this.backdropElement = this.$.overlay;
this.alwaysOnTop = true;
this.withBackdrop = true;
},
_openHandler: function (newVal, oldVal) {
this._toggleHandler();
},
_toggleHandler: function (show) {
this.toggleClass('c-action-sheet--is-open', show || this.open, this.$.sheet);
},
_toggle: function () {
this.open = !this.open;
},
_handleModifier: function (newVal, oldVal) {
var types;
var klass = 'c-action-sheet--' + oldVal;
this.toggleClass(klass, false, this.$.sheet);
types = newVal.split(' ');
for (var i = 0; i < types.length; i++) {
klass = 'c-action-sheet--' + types[i];
this.toggleClass(klass, true, this.$.sheet);
}
},
resetLayout: function () {
this.debounce('_resetLayout', function () {
});
},
_resizeHandler: function () {
}
});
Polymer.NeonAnimatableBehavior = {
properties: {
animationConfig: { type: Object },
entryAnimation: {
observer: '_entryAnimationChanged',
type: String
},
exitAnimation: {
observer: '_exitAnimationChanged',
type: String
}
},
_entryAnimationChanged: function () {
this.animationConfig = this.animationConfig || {};
this.animationConfig['entry'] = [{
name: this.entryAnimation,
node: this
}];
},
_exitAnimationChanged: function () {
this.animationConfig = this.animationConfig || {};
this.animationConfig['exit'] = [{
name: this.exitAnimation,
node: this
}];
},
_copyProperties: function (config1, config2) {
for (var property in config2) {
config1[property] = config2[property];
}
},
_cloneConfig: function (config) {
var clone = { isClone: true };
this._copyProperties(clone, config);
return clone;
},
_getAnimationConfigRecursive: function (type, map, allConfigs) {
if (!this.animationConfig) {
return;
}
if (this.animationConfig.value && typeof this.animationConfig.value === 'function') {
this._warn(this._logf('playAnimation', 'Please put \'animationConfig\' inside of your components \'properties\' object instead of outside of it.'));
return;
}
var thisConfig;
if (type) {
thisConfig = this.animationConfig[type];
} else {
thisConfig = this.animationConfig;
}
if (!Array.isArray(thisConfig)) {
thisConfig = [thisConfig];
}
if (thisConfig) {
for (var config, index = 0; config = thisConfig[index]; index++) {
if (config.animatable) {
config.animatable._getAnimationConfigRecursive(config.type || type, map, allConfigs);
} else {
if (config.id) {
var cachedConfig = map[config.id];
if (cachedConfig) {
if (!cachedConfig.isClone) {
map[config.id] = this._cloneConfig(cachedConfig);
cachedConfig = map[config.id];
}
this._copyProperties(cachedConfig, config);
} else {
map[config.id] = config;
}
} else {
allConfigs.push(config);
}
}
}
}
},
getAnimationConfig: function (type) {
var map = {};
var allConfigs = [];
this._getAnimationConfigRecursive(type, map, allConfigs);
for (var key in map) {
allConfigs.push(map[key]);
}
return allConfigs;
}
};
Polymer.NeonAnimationRunnerBehaviorImpl = {
properties: { _player: { type: Object } },
_configureAnimationEffects: function (allConfigs) {
var allAnimations = [];
if (allConfigs.length > 0) {
for (var config, index = 0; config = allConfigs[index]; index++) {
var animation = document.createElement(config.name);
if (animation.isNeonAnimation) {
var effect = animation.configure(config);
if (effect) {
allAnimations.push({
animation: animation,
config: config,
effect: effect
});
}
} else {
console.warn(this.is + ':', config.name, 'not found!');
}
}
}
return allAnimations;
},
_runAnimationEffects: function (allEffects) {
return document.timeline.play(new GroupEffect(allEffects));
},
_completeAnimations: function (allAnimations) {
for (var animation, index = 0; animation = allAnimations[index]; index++) {
animation.animation.complete(animation.config);
}
},
playAnimation: function (type, cookie) {
var allConfigs = this.getAnimationConfig(type);
if (!allConfigs) {
return;
}
try {
var allAnimations = this._configureAnimationEffects(allConfigs);
var allEffects = allAnimations.map(function (animation) {
return animation.effect;
});
if (allEffects.length > 0) {
this._player = this._runAnimationEffects(allEffects);
this._player.onfinish = function () {
this._completeAnimations(allAnimations);
if (this._player) {
this._player.cancel();
this._player = null;
}
this.fire('neon-animation-finish', cookie, { bubbles: false });
}.bind(this);
return;
}
} catch (e) {
console.warn('Couldnt play', '(', type, allConfigs, ').', e);
}
this.fire('neon-animation-finish', cookie, { bubbles: false });
},
cancelAnimation: function () {
if (this._player) {
this._player.cancel();
}
}
};
Polymer.NeonAnimationRunnerBehavior = [
Polymer.NeonAnimatableBehavior,
Polymer.NeonAnimationRunnerBehaviorImpl
];
(function (w, undefined) {
var doc = w.document, docElem = doc.documentElement, enabledClassName = 'overthrow-enabled', canBeFilledWithPoly = 'ontouchmove' in doc, nativeOverflow = 'WebkitOverflowScrolling' in docElem.style || 'msOverflowStyle' in docElem.style || !canBeFilledWithPoly && w.screen.width > 800 || function () {
var ua = w.navigator.userAgent, webkit = ua.match(/AppleWebKit\/([0-9]+)/), wkversion = webkit && webkit[1], wkLte534 = webkit && wkversion >= 534;
return ua.match(/Android ([0-9]+)/) && RegExp.$1 >= 3 && wkLte534 || ua.match(/ Version\/([0-9]+)/) && RegExp.$1 >= 0 && w.blackberry && wkLte534 || ua.indexOf('PlayBook') > -1 && wkLte534 && !ua.indexOf('Android 2') === -1 || ua.match(/Firefox\/([0-9]+)/) && RegExp.$1 >= 4 || ua.match(/wOSBrowser\/([0-9]+)/) && RegExp.$1 >= 233 && wkLte534 || ua.match(/NokiaBrowser\/([0-9\.]+)/) && parseFloat(RegExp.$1) === 7.3 && webkit && wkversion >= 533;
}();
w.overthrow = {};
w.overthrow.enabledClassName = enabledClassName;
w.overthrow.addClass = function () {
if (docElem.className.indexOf(w.overthrow.enabledClassName) === -1) {
docElem.className += ' ' + w.overthrow.enabledClassName;
}
};
w.overthrow.removeClass = function () {
docElem.className = docElem.className.replace(w.overthrow.enabledClassName, '');
};
w.overthrow.set = function () {
if (nativeOverflow) {
w.overthrow.addClass();
}
};
w.overthrow.canBeFilledWithPoly = canBeFilledWithPoly;
w.overthrow.forget = function () {
w.overthrow.removeClass();
};
w.overthrow.support = nativeOverflow ? 'native' : 'none';
}(this));
(function (w, o, undefined) {
if (o === undefined) {
return;
}
o.scrollIndicatorClassName = 'overthrow';
var doc = w.document, docElem = doc.documentElement, nativeOverflow = o.support === 'native', canBeFilledWithPoly = o.canBeFilledWithPoly, configure = o.configure, set = o.set, forget = o.forget, scrollIndicatorClassName = o.scrollIndicatorClassName;
o.closest = function (target, ascend) {
return !ascend && target.className && target.className.indexOf(scrollIndicatorClassName) > -1 && target || o.closest(target.parentNode);
};
var enabled = false;
o.set = function () {
set();
if (enabled || nativeOverflow || !canBeFilledWithPoly) {
return;
}
w.overthrow.addClass();
enabled = true;
o.support = 'polyfilled';
o.forget = function () {
forget();
enabled = false;
if (doc.removeEventListener) {
doc.removeEventListener('touchstart', start, false);
}
};
var elem, lastTops = [], lastLefts = [], lastDown, lastRight, resetVertTracking = function () {
lastTops = [];
lastDown = null;
}, resetHorTracking = function () {
lastLefts = [];
lastRight = null;
}, inputs, setPointers = function (val) {
inputs = elem.querySelectorAll('textarea, input');
for (var i = 0, il = inputs.length; i < il; i++) {
inputs[i].style.pointerEvents = val;
}
}, changeScrollTarget = function (startEvent, ascend) {
if (doc.createEvent) {
var newTarget = (!ascend || ascend === undefined) && elem.parentNode || elem.touchchild || elem, tEnd;
if (newTarget !== elem) {
tEnd = doc.createEvent('HTMLEvents');
tEnd.initEvent('touchend', true, true);
elem.dispatchEvent(tEnd);
newTarget.touchchild = elem;
elem = newTarget;
newTarget.dispatchEvent(startEvent);
}
}
}, start = function (e) {
if (o.intercept) {
o.intercept();
}
resetVertTracking();
resetHorTracking();
elem = o.closest(e.target);
if (!elem || elem === docElem || e.touches.length > 1) {
return;
}
setPointers('none');
var touchStartE = e, scrollT = elem.scrollTop, scrollL = elem.scrollLeft, height = elem.offsetHeight, width = elem.offsetWidth, startY = e.touches[0].pageY, startX = e.touches[0].pageX, scrollHeight = elem.scrollHeight, scrollWidth = elem.scrollWidth, move = function (e) {
var ty = scrollT + startY - e.touches[0].pageY, tx = scrollL + startX - e.touches[0].pageX, down = ty >= (lastTops.length ? lastTops[0] : 0), right = tx >= (lastLefts.length ? lastLefts[0] : 0);
if (ty > 0 && ty < scrollHeight - height || tx > 0 && tx < scrollWidth - width) {
e.preventDefault();
} else {
changeScrollTarget(touchStartE);
}
if (lastDown && down !== lastDown) {
resetVertTracking();
}
if (lastRight && right !== lastRight) {
resetHorTracking();
}
lastDown = down;
lastRight = right;
elem.scrollTop = ty;
elem.scrollLeft = tx;
lastTops.unshift(ty);
lastLefts.unshift(tx);
if (lastTops.length > 3) {
lastTops.pop();
}
if (lastLefts.length > 3) {
lastLefts.pop();
}
}, end = function (e) {
setPointers('auto');
setTimeout(function () {
setPointers('none');
}, 450);
elem.removeEventListener('touchmove', move, false);
elem.removeEventListener('touchend', end, false);
};
elem.addEventListener('touchmove', move, false);
elem.addEventListener('touchend', end, false);
};
doc.addEventListener('touchstart', start, false);
};
}(this, this.overthrow));
(function (w, o, undefined) {
if (o === undefined) {
w.overthrow = o = {};
}
o.easing = function (t, b, c, d) {
return c * ((t = t / d - 1) * t * t + 1) + b;
};
o.tossing = false;
var timeKeeper;
o.toss = function (elem, options) {
o.intercept();
var i = 0, sLeft = elem.scrollLeft, sTop = elem.scrollTop, op = {
top: '+0',
left: '+0',
duration: 50,
easing: o.easing,
finished: function () {
}
}, endLeft, endTop, finished = false;
if (options) {
for (var j in op) {
if (options[j] !== undefined) {
op[j] = options[j];
}
}
}
if (typeof op.left === 'string') {
op.left = parseFloat(op.left);
endLeft = op.left + sLeft;
} else {
endLeft = op.left;
op.left = op.left - sLeft;
}
if (typeof op.top === 'string') {
op.top = parseFloat(op.top);
endTop = op.top + sTop;
} else {
endTop = op.top;
op.top = op.top - sTop;
}
o.tossing = true;
timeKeeper = setInterval(function () {
if (i++ < op.duration) {
elem.scrollLeft = op.easing(i, sLeft, op.left, op.duration);
elem.scrollTop = op.easing(i, sTop, op.top, op.duration);
} else {
if (endLeft !== elem.scrollLeft) {
elem.scrollLeft = endLeft;
} else {
if (finished) {
op.finished();
}
finished = true;
}
if (endTop !== elem.scrollTop) {
elem.scrollTop = endTop;
} else {
if (finished) {
op.finished();
}
finished = true;
}
o.intercept();
}
}, 1);
return {
top: endTop,
left: endLeft,
duration: o.duration,
easing: o.easing
};
};
o.intercept = function () {
clearInterval(timeKeeper);
o.tossing = false;
};
}(this, this.overthrow));
(function (w, undefined) {
w.overthrow.set();
}(this));
var transitions = [
{
leave: 'moveToLeft',
enter: 'moveFromRight'
},
{
leave: 'moveToRight',
enter: 'moveFromLeft'
},
{
leave: 'moveToBottom',
enter: 'moveFromTop'
},
{
leave: 'fade',
enter: 'moveFromRight ontop'
},
{
leave: 'fade',
enter: 'moveFromLeft ontop'
},
{
leave: 'fade',
enter: 'moveFromBottom ontop'
},
{
leave: 'fade',
enter: 'moveFromTop ontop'
},
{
leave: 'moveToLeftFade',
enter: 'moveFromRightFade'
},
{
leave: 'moveToRightFade',
enter: 'moveFromLeftFade'
},
{
leave: 'moveToTopFade',
enter: 'moveFromBottomFade'
},
{
leave: 'moveToBottomFade',
enter: 'moveFromTopFade'
},
{
leave: 'moveToLeftEasing ontop',
enter: 'moveFromRight'
},
{
leave: 'moveToRightEasing ontop',
enter: 'moveFromLeft'
},
{
leave: 'moveToTopEasing ontop',
enter: 'moveFromBottom'
},
{
leave: 'moveToBottomEasing ontop',
enter: 'moveFromTop'
},
{
leave: 'scaleDown',
enter: 'moveFromRight ontop'
},
{
leave: 'scaleDown',
enter: 'moveFromLeft ontop'
},
{
leave: 'scaleDown',
enter: 'moveFromBottom ontop'
},
{
leave: 'scaleDown',
enter: 'moveFromTop ontop'
},
{
leave: 'scaleDown',
enter: 'scaleUpDown delay300'
},
{
leave: 'scaleDownUp',
enter: 'scaleUp delay300'
},
{
leave: 'moveToLeft ontop',
enter: 'scaleUp'
},
{
leave: 'moveToRight ontop',
enter: 'scaleUp'
},
{
leave: 'moveToTop ontop',
enter: 'scaleUp'
},
{
leave: 'moveToBottom ontop',
enter: 'scaleUp'
},
{
leave: 'scaleDownCenter',
enter: 'scaleUpCenter delay400'
},
{
leave: 'rotateRightSideFirst',
enter: 'moveFromRight delay20 ontop'
},
{
leave: 'rotateLeftSideFirst',
enter: 'moveFromLeft delay20 ontop'
},
{
leave: 'rotateTopSideFirst',
enter: 'moveFromTop delay20 ontop'
},
{
leave: 'rotateBottomSideFirst',
enter: 'moveFromBottom delay20 ontop'
},
{
leave: 'flipOutRight',
enter: 'flipInLeft delay500'
},
{
leave: 'flipOutLeft',
enter: 'flipInRight delay500'
},
{
leave: 'flipOutTop',
enter: 'flipInBottom delay500'
},
{
leave: 'flipOutBottom',
enter: 'flipInTop delay500'
},
{
leave: 'rotateFall ontop',
enter: 'scaleUp'
},
{
leave: 'rotateOutNewspaper',
enter: 'rotateInNewspaper delay500'
},
{
leave: 'rotatePushLeft',
enter: 'moveFromRight'
},
{
leave: 'rotatePushRight',
enter: 'moveFromLeft'
},
{
leave: 'rotatePushTop',
enter: 'moveFromBottom'
},
{
leave: 'rotatePushBottom',
enter: 'moveFromTop'
},
{
leave: 'rotatePushLeft',
enter: 'rotatePullRight delay180'
},
{
leave: 'rotatePushRight',
enter: 'rotatePullLeft delay180'
},
{
leave: 'rotatePushTop',
enter: 'rotatePullBottom delay180'
},
{
leave: 'rotatePushBottom',
enter: 'rotatePullTop delay180'
},
{
leave: 'rotateFoldLeft',
enter: 'moveFromRightFade'
},
{
leave: 'rotateFoldRight',
enter: 'moveFromLeftFade'
},
{
leave: 'rotateFoldTop',
enter: 'moveFromBottomFade'
},
{
leave: 'rotateFoldBottom',
enter: 'moveFromTopFade'
},
{
leave: 'moveToRightFade',
enter: 'rotateUnfoldLeft'
},
{
leave: 'moveToLeftFade',
enter: 'rotateUnfoldRight'
},
{
leave: 'moveToBottomFade',
enter: 'rotateUnfoldTop'
},
{
leave: 'moveToTopFade',
enter: 'rotateUnfoldBottom'
},
{
leave: 'rotateRoomLeftOut ontop',
enter: 'rotateRoomLeftIn'
},
{
leave: 'rotateRoomRightOut ontop',
enter: 'rotateRoomRightIn'
},
{
leave: 'rotateRoomTopOut ontop',
enter: 'rotateRoomTopIn'
},
{
leave: 'rotateRoomBottomOut ontop',
enter: 'rotateRoomBottomIn'
},
{
leave: 'rotateCubeLeftOut ontop',
enter: 'rotateCubeLeftIn'
},
{
leave: 'rotateCubeRightOut ontop',
enter: 'rotateCubeRightIn'
},
{
leave: 'rotateCubeTopOut ontop',
enter: 'rotateCubeTopIn'
},
{
leave: 'rotateCubeBottomOut ontop',
enter: 'rotateCubeBottomIn'
},
{
leave: 'rotateCarouselLeftOut ontop',
enter: 'rotateCarouselLeftIn'
},
{
leave: 'rotateCarouselRightOut ontop',
enter: 'rotateCarouselRightIn'
},
{
leave: 'rotateCarouselTopOut ontop',
enter: 'rotateCarouselTopIn'
},
{
leave: 'rotateCarouselBottomOut ontop',
enter: 'rotateCarouselBottomIn'
},
{
leave: 'rotateSidesOut',
enter: 'rotateSidesIn delay200'
},
{
leave: 'rotateSlideOut',
enter: 'rotateSlideIn'
}
].reverse();
function formatClass(str) {
var classes = str.split(' ');
var output = [];
for (var i = 0; i < classes.length; i++) {
output.push('pt-page-' + classes[i]);
}
return output;
}
function resetPage($outpage, $inpage) {
$outpage.attr('class', $outpage.attr('data-originalClassList'));
$inpage.attr('class', $inpage.attr('data-originalClassList') + ' et-page-current');
console.warn('resetPage');
}
function onEndAnimation($outpage, $inpage, block) {
resetPage($outpage, $inpage);
$outpage.trigger('animation.out.complete');
$inpage.trigger('animation.in.complete');
block.attr('data-isAnimating', 'false');
console.warn('onEndAnimation');
}
function PageTransitions() {
var startElement = 0, animEndEventName = '', animEndEventNames = {
'WebkitAnimation': 'webkitAnimationEnd',
'OAnimation': 'oAnimationEnd',
'msAnimation': 'MSAnimationEnd',
'animation': 'animationend'
};
function getTransitionPrefix() {
var v = [
'Moz',
'Webkit',
'Khtml',
'O',
'ms'
];
var b = document.body || document.documentElement;
var s = b.style;
var p = 'animation';
if (typeof s[p] === 'string') {
return 'animation';
}
p = p.charAt(0).toUpperCase() + p.substr(1);
for (var i = 0; i < v.length; i++) {
if (typeof s[v[i] + p] === 'string') {
return v[i] + p;
}
}
return false;
}
animEndEventName = animEndEventNames[getTransitionPrefix()];
function init(selected) {
startElement = selected;
console.warn('PageTransitions.init', selected);
var views = document.querySelectorAll('px-view');
views.each(function (el) {
console.log(el);
el.attr('data-originalClassList', el.attr('class'));
});
document.querySelectorAll('px-views').each(function (el) {
el.attr('data-current', '0');
el.attr('data-isAnimating', 'false');
});
views[selected].removeClass('next');
}
function animate(options) {
var el, wrapper, inClass, outClass, nextPage, currPage;
el = document.getElementById(options.el);
console.log('Animate', options, el);
if (el && el.container) {
wrapper = el.container;
}
if (!el.inTrans) {
el.inTrans = transitions[1].enter;
}
if (!el.outTrans) {
el.outTrans = transitions[1].leave;
}
inClass = formatClass(el.inTrans);
outClass = formatClass(el.outTrans);
currPage = options.current || wrapper.getSelectedPage();
nextPage = options.next || wrapper.getNext();
console.warn('Animate currPage', currPage);
console.warn('Animate nextPage', nextPage);
var endCurrPage = false;
var endNextPage = false;
if (wrapper.getAttribute('data-isAnimating') === 'true') {
console.log(wrapper, wrapper.getAttribute('data-isAnimating'));
return false;
}
wrapper.setAttribute('data-isAnimating', 'true');
outClass.forEach(function (c) {
console.warn('adding class', c);
currPage.classList.add(c);
});
currPage.addEventListener(animEndEventName, function transitionHandler() {
console.warn(animEndEventName, 'finished - removing handler');
currPage.removeEventListener(animEndEventName, transitionHandler);
endCurrPage = true;
if (endNextPage) {
onEndAnimation(currPage, nextPage, el);
}
});
inClass.forEach(function (c) {
nextPage.classList.add(c);
});
nextPage.addEventListener(animEndEventName, function () {
console.warn('Adding event listener to nextPage');
nextPage.removeEventListener(animEndEventName);
endNextPage = true;
if (endCurrPage) {
onEndAnimation(currPage, nextPage, el);
if (options.callback) {
options.callback(currPage, nextPage);
}
}
});
console.warn('animate element', options, animEndEventName, inClass, outClass);
console.warn('wrapper', wrapper);
}
return {
init: init,
animate: animate
};
};
var PageBehavior = {
attached: function () {
this.async(function () {
if (this.dialog) {
this.toggleClass('dialog');
}
this._fixNavbar();
});
this.fire('px-page-ready', this);
},
_fixContent: function () {
var contentHeight = this.$.pageContent.offsetHeight;
console.warn('Resize content to', contentHeight);
},
_fixNavbar: function () {
var pageContent = this.$.pageContent;
var pageNavbar = this.queryEffectiveChildren('px-navbar');
if (pageNavbar) {
this.toggleClass('has-navbar', true);
if (this.theme) {
pageNavbar.theme = this.theme;
}
if (this.title) {
pageNavbar.title = this.title;
}
this.navbar = pageNavbar;
}
},
show: function () {
this.toggleClass('current', false, this);
},
hide: function () {
this.toggleClass('hidden', true, this);
},
update: function () {
console.log('INFO', 'update view', this.id);
},
_tmplChanged: function (newVal, oldVal) {
var _this = this, html = '';
if (newVal) {
this.importHref(newVal, function (e) {
html = e.target.import.body.innerHTML;
_this.$$('.page-content').innerHTML = html;
}, function (err) {
console.error('Error loading page', err);
});
}
},
open: function () {
if (this.dialog) {
this.toggleClass(this.currentClass);
this.toggleClass('is-open');
}
},
close: function () {
if (this.dialog) {
this.toggleClass('et-page-current');
this.toggleClass('is-open');
}
}
};
Polymer.NeonAnimationBehavior = {
properties: {
animationTiming: {
type: Object,
value: function () {
return {
duration: 500,
easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
fill: 'both'
};
}
}
},
isNeonAnimation: true,
timingFromConfig: function (config) {
if (config.timing) {
for (var property in config.timing) {
this.animationTiming[property] = config.timing[property];
}
}
return this.animationTiming;
},
setPrefixedProperty: function (node, property, value) {
var map = {
'transform': ['webkitTransform'],
'transformOrigin': [
'mozTransformOrigin',
'webkitTransformOrigin'
]
};
var prefixes = map[property];
for (var prefix, index = 0; prefix = prefixes[index]; index++) {
node.style[prefix] = value;
}
node.style[property] = value;
},
complete: function () {
}
};
!function (a, b) {
var c = {}, d = {}, e = {}, f = null;
!function (a, b) {
function c(a) {
if ('number' == typeof a)
return a;
var b = {};
for (var c in a)
b[c] = a[c];
return b;
}
function d() {
this._delay = 0, this._endDelay = 0, this._fill = 'none', this._iterationStart = 0, this._iterations = 1, this._duration = 0, this._playbackRate = 1, this._direction = 'normal', this._easing = 'linear', this._easingFunction = w;
}
function e() {
return a.isDeprecated('Invalid timing inputs', '2016-03-02', 'TypeError exceptions will be thrown instead.', !0);
}
function f(b, c, e) {
var f = new d();
return c && (f.fill = 'both', f.duration = 'auto'), 'number' != typeof b || isNaN(b) ? void 0 !== b && Object.getOwnPropertyNames(b).forEach(function (c) {
if ('auto' != b[c]) {
if (('number' == typeof f[c] || 'duration' == c) && ('number' != typeof b[c] || isNaN(b[c])))
return;
if ('fill' == c && -1 == u.indexOf(b[c]))
return;
if ('direction' == c && -1 == v.indexOf(b[c]))
return;
if ('playbackRate' == c && 1 !== b[c] && a.isDeprecated('AnimationEffectTiming.playbackRate', '2014-11-28', 'Use Animation.playbackRate instead.'))
return;
f[c] = b[c];
}
}) : f.duration = b, f;
}
function g(a) {
return 'number' == typeof a && (a = isNaN(a) ? { duration: 0 } : { duration: a }), a;
}
function h(b, c) {
return b = a.numericTimingToObject(b), f(b, c);
}
function i(a, b, c, d) {
return 0 > a || a > 1 || 0 > c || c > 1 ? w : function (e) {
function f(a, b, c) {
return 3 * a * (1 - c) * (1 - c) * c + 3 * b * (1 - c) * c * c + c * c * c;
}
if (0 == e || 1 == e)
return e;
for (var g = 0, h = 1;;) {
var i = (g + h) / 2, j = f(a, c, i);
if (Math.abs(e - j) < 0.0001)
return f(b, d, i);
e > j ? g = i : h = i;
}
};
}
function j(a, b) {
return function (c) {
if (c >= 1)
return 1;
var d = 1 / a;
return c += b * d, c - c % d;
};
}
function k(a) {
B || (B = document.createElement('div').style), B.animationTimingFunction = '', B.animationTimingFunction = a;
var b = B.animationTimingFunction;
if ('' == b && e())
throw new TypeError(a + ' is not a valid value for easing');
var c = D.exec(b);
if (c)
return i.apply(this, c.slice(1).map(Number));
var d = E.exec(b);
if (d)
return j(Number(d[1]), {
start: x,
middle: y,
end: z
}[d[2]]);
var f = A[b];
return f ? f : w;
}
function l(a) {
return Math.abs(m(a) / a.playbackRate);
}
function m(a) {
return a.duration * a.iterations;
}
function n(a, b, c) {
return null == b ? F : b < c.delay ? G : b >= c.delay + a ? H : I;
}
function o(a, b, c, d, e) {
switch (d) {
case G:
return 'backwards' == b || 'both' == b ? 0 : null;
case I:
return c - e;
case H:
return 'forwards' == b || 'both' == b ? a : null;
case F:
return null;
}
}
function p(a, b, c, d) {
return (d.playbackRate < 0 ? b - a : b) * d.playbackRate + c;
}
function q(a, b, c, d, e) {
return c === 1 / 0 || c === -(1 / 0) || c - d == b && e.iterations && (e.iterations + e.iterationStart) % 1 == 0 ? a : c % a;
}
function r(a, b, c, d) {
return 0 === c ? 0 : b == a ? d.iterationStart + d.iterations - 1 : Math.floor(c / a);
}
function s(a, b, c, d) {
var e = a % 2 >= 1, f = 'normal' == d.direction || d.direction == (e ? 'alternate-reverse' : 'alternate'), g = f ? c : b - c, h = g / b;
return b * d._easingFunction(h);
}
function t(a, b, c) {
var d = n(a, b, c), e = o(a, c.fill, b, d, c.delay);
if (null === e)
return null;
if (0 === a)
return d === G ? 0 : 1;
var f = c.iterationStart * c.duration, g = p(a, e, f, c), h = q(c.duration, m(c), g, f, c), i = r(c.duration, h, g, c);
return s(i, c.duration, h, c) / c.duration;
}
var u = 'backwards|forwards|both|none'.split('|'), v = 'reverse|alternate|alternate-reverse'.split('|'), w = function (a) {
return a;
};
d.prototype = {
_setMember: function (b, c) {
this['_' + b] = c, this._effect && (this._effect._timingInput[b] = c, this._effect._timing = a.normalizeTimingInput(this._effect._timingInput), this._effect.activeDuration = a.calculateActiveDuration(this._effect._timing), this._effect._animation && this._effect._animation._rebuildUnderlyingAnimation());
},
get playbackRate() {
return this._playbackRate;
},
set delay(a) {
this._setMember('delay', a);
},
get delay() {
return this._delay;
},
set endDelay(a) {
this._setMember('endDelay', a);
},
get endDelay() {
return this._endDelay;
},
set fill(a) {
this._setMember('fill', a);
},
get fill() {
return this._fill;
},
set iterationStart(a) {
if ((isNaN(a) || 0 > a) && e())
throw new TypeError('iterationStart must be a non-negative number, received: ' + timing.iterationStart);
this._setMember('iterationStart', a);
},
get iterationStart() {
return this._iterationStart;
},
set duration(a) {
if ('auto' != a && (isNaN(a) || 0 > a) && e())
throw new TypeError('duration must be non-negative or auto, received: ' + a);
this._setMember('duration', a);
},
get duration() {
return this._duration;
},
set direction(a) {
this._setMember('direction', a);
},
get direction() {
return this._direction;
},
set easing(a) {
this._easingFunction = k(a), this._setMember('easing', a);
},
get easing() {
return this._easing;
},
set iterations(a) {
if ((isNaN(a) || 0 > a) && e())
throw new TypeError('iterations must be non-negative, received: ' + a);
this._setMember('iterations', a);
},
get iterations() {
return this._iterations;
}
};
var x = 1, y = 0.5, z = 0, A = {
ease: i(0.25, 0.1, 0.25, 1),
'ease-in': i(0.42, 0, 1, 1),
'ease-out': i(0, 0, 0.58, 1),
'ease-in-out': i(0.42, 0, 0.58, 1),
'step-start': j(1, x),
'step-middle': j(1, y),
'step-end': j(1, z)
}, B = null, C = '\\s*(-?\\d+\\.?\\d*|-?\\.\\d+)\\s*', D = new RegExp('cubic-bezier\\(' + C + ',' + C + ',' + C + ',' + C + '\\)'), E = /steps\(\s*(\d+)\s*,\s*(start|middle|end)\s*\)/, F = 0, G = 1, H = 2, I = 3;
a.cloneTimingInput = c, a.makeTiming = f, a.numericTimingToObject = g, a.normalizeTimingInput = h, a.calculateActiveDuration = l, a.calculateTimeFraction = t, a.calculatePhase = n, a.toTimingFunction = k;
}(c, f), function (a, b) {
function c(a, b) {
return a in j ? j[a][b] || b : b;
}
function d(a, b, d) {
var e = g[a];
if (e) {
h.style[a] = b;
for (var f in e) {
var i = e[f], j = h.style[i];
d[i] = c(i, j);
}
} else
d[a] = c(a, b);
}
function e(a) {
var b = [];
for (var c in a)
if (!(c in [
'easing',
'offset',
'composite'
])) {
var d = a[c];
Array.isArray(d) || (d = [d]);
for (var e, f = d.length, g = 0; f > g; g++)
e = {}, 'offset' in a ? e.offset = a.offset : 1 == f ? e.offset = 1 : e.offset = g / (f - 1), 'easing' in a && (e.easing = a.easing), 'composite' in a && (e.composite = a.composite), e[c] = d[g], b.push(e);
}
return b.sort(function (a, b) {
return a.offset - b.offset;
}), b;
}
function f(a) {
function b() {
var a = c.length;
null == c[a - 1].offset && (c[a - 1].offset = 1), a > 1 && null == c[0].offset && (c[0].offset = 0);
for (var b = 0, d = c[0].offset, e = 1; a > e; e++) {
var f = c[e].offset;
if (null != f) {
for (var g = 1; e - b > g; g++)
c[b + g].offset = d + (f - d) * g / (e - b);
b = e, d = f;
}
}
}
if (null == a)
return [];
window.Symbol && Symbol.iterator && Array.prototype.from && a[Symbol.iterator] && (a = Array.from(a)), Array.isArray(a) || (a = e(a));
for (var c = a.map(function (a) {
var b = {};
for (var c in a) {
var e = a[c];
if ('offset' == c) {
if (null != e && (e = Number(e), !isFinite(e)))
throw new TypeError('keyframe offsets must be numbers.');
} else {
if ('composite' == c)
throw {
type: DOMException.NOT_SUPPORTED_ERR,
name: 'NotSupportedError',
message: 'add compositing is not supported'
};
e = '' + e;
}
d(c, e, b);
}
return void 0 == b.offset && (b.offset = null), b;
}), f = !0, g = -(1 / 0), h = 0; h < c.length; h++) {
var i = c[h].offset;
if (null != i) {
if (g > i)
throw {
code: DOMException.INVALID_MODIFICATION_ERR,
name: 'InvalidModificationError',
message: 'Keyframes are not loosely sorted by offset. Sort or specify offsets.'
};
g = i;
} else
f = !1;
}
return c = c.filter(function (a) {
return a.offset >= 0 && a.offset <= 1;
}), f || b(), c;
}
var g = {
background: [
'backgroundImage',
'backgroundPosition',
'backgroundSize',
'backgroundRepeat',
'backgroundAttachment',
'backgroundOrigin',
'backgroundClip',
'backgroundColor'
],
border: [
'borderTopColor',
'borderTopStyle',
'borderTopWidth',
'borderRightColor',
'borderRightStyle',
'borderRightWidth',
'borderBottomColor',
'borderBottomStyle',
'borderBottomWidth',
'borderLeftColor',
'borderLeftStyle',
'borderLeftWidth'
],
borderBottom: [
'borderBottomWidth',
'borderBottomStyle',
'borderBottomColor'
],
borderColor: [
'borderTopColor',
'borderRightColor',
'borderBottomColor',
'borderLeftColor'
],
borderLeft: [
'borderLeftWidth',
'borderLeftStyle',
'borderLeftColor'
],
borderRadius: [
'borderTopLeftRadius',
'borderTopRightRadius',
'borderBottomRightRadius',
'borderBottomLeftRadius'
],
borderRight: [
'borderRightWidth',
'borderRightStyle',
'borderRightColor'
],
borderTop: [
'borderTopWidth',
'borderTopStyle',
'borderTopColor'
],
borderWidth: [
'borderTopWidth',
'borderRightWidth',
'borderBottomWidth',
'borderLeftWidth'
],
flex: [
'flexGrow',
'flexShrink',
'flexBasis'
],
font: [
'fontFamily',
'fontSize',
'fontStyle',
'fontVariant',
'fontWeight',
'lineHeight'
],
margin: [
'marginTop',
'marginRight',
'marginBottom',
'marginLeft'
],
outline: [
'outlineColor',
'outlineStyle',
'outlineWidth'
],
padding: [
'paddingTop',
'paddingRight',
'paddingBottom',
'paddingLeft'
]
}, h = document.createElementNS('http://www.w3.org/1999/xhtml', 'div'), i = {
thin: '1px',
medium: '3px',
thick: '5px'
}, j = {
borderBottomWidth: i,
borderLeftWidth: i,
borderRightWidth: i,
borderTopWidth: i,
fontSize: {
'xx-small': '60%',
'x-small': '75%',
small: '89%',
medium: '100%',
large: '120%',
'x-large': '150%',
'xx-large': '200%'
},
fontWeight: {
normal: '400',
bold: '700'
},
outlineWidth: i,
textShadow: { none: '0px 0px 0px transparent' },
boxShadow: { none: '0px 0px 0px 0px transparent' }
};
a.convertToArrayForm = e, a.normalizeKeyframes = f;
}(c, f), function (a) {
var b = {};
a.isDeprecated = function (a, c, d, e) {
var f = e ? 'are' : 'is', g = new Date(), h = new Date(c);
return h.setMonth(h.getMonth() + 3), h > g ? (a in b || console.warn('Web Animations: ' + a + ' ' + f + ' deprecated and will stop working on ' + h.toDateString() + '. ' + d), b[a] = !0, !1) : !0;
}, a.deprecated = function (b, c, d, e) {
var f = e ? 'are' : 'is';
if (a.isDeprecated(b, c, d, e))
throw new Error(b + ' ' + f + ' no longer supported. ' + d);
};
}(c), function () {
if (document.documentElement.animate) {
var a = document.documentElement.animate([], 0), b = !0;
if (a && (b = !1, 'play|currentTime|pause|reverse|playbackRate|cancel|finish|startTime|playState'.split('|').forEach(function (c) {
void 0 === a[c] && (b = !0);
})), !b)
return;
}
!function (a, b, c) {
function d(a) {
for (var b = {}, c = 0; c < a.length; c++)
for (var d in a[c])
if ('offset' != d && 'easing' != d && 'composite' != d) {
var e = {
offset: a[c].offset,
easing: a[c].easing,
value: a[c][d]
};
b[d] = b[d] || [], b[d].push(e);
}
for (var f in b) {
var g = b[f];
if (0 != g[0].offset || 1 != g[g.length - 1].offset)
throw {
type: DOMException.NOT_SUPPORTED_ERR,
name: 'NotSupportedError',
message: 'Partial keyframes are not supported'
};
}
return b;
}
function e(c) {
var d = [];
for (var e in c)
for (var f = c[e], g = 0; g < f.length - 1; g++) {
var h = f[g].offset, i = f[g + 1].offset, j = f[g].value, k = f[g + 1].value, l = f[g].easing;
h == i && (1 == i ? j = k : k = j), d.push({
startTime: h,
endTime: i,
easing: a.toTimingFunction(l ? l : 'linear'),
property: e,
interpolation: b.propertyInterpolation(e, j, k)
});
}
return d.sort(function (a, b) {
return a.startTime - b.startTime;
}), d;
}
b.convertEffectInput = function (c) {
var f = a.normalizeKeyframes(c), g = d(f), h = e(g);
return function (a, c) {
if (null != c)
h.filter(function (a) {
return 0 >= c && 0 == a.startTime || c >= 1 && 1 == a.endTime || c >= a.startTime && c <= a.endTime;
}).forEach(function (d) {
var e = c - d.startTime, f = d.endTime - d.startTime, g = 0 == f ? 0 : d.easing(e / f);
b.apply(a, d.property, d.interpolation(g));
});
else
for (var d in g)
'offset' != d && 'easing' != d && 'composite' != d && b.clear(a, d);
};
};
}(c, d, f), function (a, b, c) {
function d(a) {
return a.replace(/-(.)/g, function (a, b) {
return b.toUpperCase();
});
}
function e(a, b, c) {
h[c] = h[c] || [], h[c].push([
a,
b
]);
}
function f(a, b, c) {
for (var f = 0; f < c.length; f++) {
var g = c[f];
e(a, b, d(g));
}
}
function g(c, e, f) {
var g = c;
/-/.test(c) && !a.isDeprecated('Hyphenated property names', '2016-03-22', 'Use camelCase instead.', !0) && (g = d(c)), 'initial' != e && 'initial' != f || ('initial' == e && (e = i[g]), 'initial' == f && (f = i[g]));
for (var j = e == f ? [] : h[g], k = 0; j && k < j.length; k++) {
var l = j[k][0](e), m = j[k][0](f);
if (void 0 !== l && void 0 !== m) {
var n = j[k][1](l, m);
if (n) {
var o = b.Interpolation.apply(null, n);
return function (a) {
return 0 == a ? e : 1 == a ? f : o(a);
};
}
}
}
return b.Interpolation(!1, !0, function (a) {
return a ? f : e;
});
}
var h = {};
b.addPropertiesHandler = f;
var i = {
backgroundColor: 'transparent',
backgroundPosition: '0% 0%',
borderBottomColor: 'currentColor',
borderBottomLeftRadius: '0px',
borderBottomRightRadius: '0px',
borderBottomWidth: '3px',
borderLeftColor: 'currentColor',
borderLeftWidth: '3px',
borderRightColor: 'currentColor',
borderRightWidth: '3px',
borderSpacing: '2px',
borderTopColor: 'currentColor',
borderTopLeftRadius: '0px',
borderTopRightRadius: '0px',
borderTopWidth: '3px',
bottom: 'auto',
clip: 'rect(0px, 0px, 0px, 0px)',
color: 'black',
fontSize: '100%',
fontWeight: '400',
height: 'auto',
left: 'auto',
letterSpacing: 'normal',
lineHeight: '120%',
marginBottom: '0px',
marginLeft: '0px',
marginRight: '0px',
marginTop: '0px',
maxHeight: 'none',
maxWidth: 'none',
minHeight: '0px',
minWidth: '0px',
opacity: '1.0',
outlineColor: 'invert',
outlineOffset: '0px',
outlineWidth: '3px',
paddingBottom: '0px',
paddingLeft: '0px',
paddingRight: '0px',
paddingTop: '0px',
right: 'auto',
textIndent: '0px',
textShadow: '0px 0px 0px transparent',
top: 'auto',
transform: '',
verticalAlign: '0px',
visibility: 'visible',
width: 'auto',
wordSpacing: 'normal',
zIndex: 'auto'
};
b.propertyInterpolation = g;
}(c, d, f), function (a, b, c) {
function d(b) {
var c = a.calculateActiveDuration(b), d = function (d) {
return a.calculateTimeFraction(c, d, b);
};
return d._totalDuration = b.delay + c + b.endDelay, d._isCurrent = function (d) {
var e = a.calculatePhase(c, d, b);
return e === PhaseActive || e === PhaseBefore;
}, d;
}
b.KeyframeEffect = function (c, e, f, g) {
var h, i = d(a.normalizeTimingInput(f)), j = b.convertEffectInput(e), k = function () {
j(c, h);
};
return k._update = function (a) {
return h = i(a), null !== h;
}, k._clear = function () {
j(c, null);
}, k._hasSameTarget = function (a) {
return c === a;
}, k._isCurrent = i._isCurrent, k._totalDuration = i._totalDuration, k._id = g, k;
}, b.NullEffect = function (a) {
var b = function () {
a && (a(), a = null);
};
return b._update = function () {
return null;
}, b._totalDuration = 0, b._isCurrent = function () {
return !1;
}, b._hasSameTarget = function () {
return !1;
}, b;
};
}(c, d, f), function (a, b) {
a.apply = function (b, c, d) {
b.style[a.propertyName(c)] = d;
}, a.clear = function (b, c) {
b.style[a.propertyName(c)] = '';
};
}(d, f), function (a) {
window.Element.prototype.animate = function (b, c) {
var d = '';
return c && c.id && (d = c.id), a.timeline._play(a.KeyframeEffect(this, b, c, d));
};
}(d), function (a, b) {
function c(a, b, d) {
if ('number' == typeof a && 'number' == typeof b)
return a * (1 - d) + b * d;
if ('boolean' == typeof a && 'boolean' == typeof b)
return 0.5 > d ? a : b;
if (a.length == b.length) {
for (var e = [], f = 0; f < a.length; f++)
e.push(c(a[f], b[f], d));
return e;
}
throw 'Mismatched interpolation arguments ' + a + ':' + b;
}
a.Interpolation = function (a, b, d) {
return function (e) {
return d(c(a, b, e));
};
};
}(d, f), function (a, b, c) {
a.sequenceNumber = 0;
var d = function (a, b, c) {
this.target = a, this.currentTime = b, this.timelineTime = c, this.type = 'finish', this.bubbles = !1, this.cancelable = !1, this.currentTarget = a, this.defaultPrevented = !1, this.eventPhase = Event.AT_TARGET, this.timeStamp = Date.now();
};
b.Animation = function (b) {
this.id = '', b && b._id && (this.id = b._id), this._sequenceNumber = a.sequenceNumber++, this._currentTime = 0, this._startTime = null, this._paused = !1, this._playbackRate = 1, this._inTimeline = !0, this._finishedFlag = !0, this.onfinish = null, this._finishHandlers = [], this._effect = b, this._inEffect = this._effect._update(0), this._idle = !0, this._currentTimePending = !1;
}, b.Animation.prototype = {
_ensureAlive: function () {
this.playbackRate < 0 && 0 === this.currentTime ? this._inEffect = this._effect._update(-1) : this._inEffect = this._effect._update(this.currentTime), this._inTimeline || !this._inEffect && this._finishedFlag || (this._inTimeline = !0, b.timeline._animations.push(this));
},
_tickCurrentTime: function (a, b) {
a != this._currentTime && (this._currentTime = a, this._isFinished && !b && (this._currentTime = this._playbackRate > 0 ? this._totalDuration : 0), this._ensureAlive());
},
get currentTime() {
return this._idle || this._currentTimePending ? null : this._currentTime;
},
set currentTime(a) {
a = +a, isNaN(a) || (b.restart(), this._paused || null == this._startTime || (this._startTime = this._timeline.currentTime - a / this._playbackRate), this._currentTimePending = !1, this._currentTime != a && (this._tickCurrentTime(a, !0), b.invalidateEffects()));
},
get startTime() {
return this._startTime;
},
set startTime(a) {
a = +a, isNaN(a) || this._paused || this._idle || (this._startTime = a, this._tickCurrentTime((this._timeline.currentTime - this._startTime) * this.playbackRate), b.invalidateEffects());
},
get playbackRate() {
return this._playbackRate;
},
set playbackRate(a) {
if (a != this._playbackRate) {
var b = this.currentTime;
this._playbackRate = a, this._startTime = null, 'paused' != this.playState && 'idle' != this.playState && this.play(), null != b && (this.currentTime = b);
}
},
get _isFinished() {
return !this._idle && (this._playbackRate > 0 && this._currentTime >= this._totalDuration || this._playbackRate < 0 && this._currentTime <= 0);
},
get _totalDuration() {
return this._effect._totalDuration;
},
get playState() {
return this._idle ? 'idle' : null == this._startTime && !this._paused && 0 != this.playbackRate || this._currentTimePending ? 'pending' : this._paused ? 'paused' : this._isFinished ? 'finished' : 'running';
},
play: function () {
this._paused = !1, (this._isFinished || this._idle) && (this._currentTime = this._playbackRate > 0 ? 0 : this._totalDuration, this._startTime = null), this._finishedFlag = !1, this._idle = !1, this._ensureAlive(), b.invalidateEffects();
},
pause: function () {
this._isFinished || this._paused || this._idle || (this._currentTimePending = !0), this._startTime = null, this._paused = !0;
},
finish: function () {
this._idle || (this.currentTime = this._playbackRate > 0 ? this._totalDuration : 0, this._startTime = this._totalDuration - this.currentTime, this._currentTimePending = !1, b.invalidateEffects());
},
cancel: function () {
this._inEffect && (this._inEffect = !1, this._idle = !0, this._finishedFlag = !0, this.currentTime = 0, this._startTime = null, this._effect._update(null), b.invalidateEffects());
},
reverse: function () {
this.playbackRate *= -1, this.play();
},
addEventListener: function (a, b) {
'function' == typeof b && 'finish' == a && this._finishHandlers.push(b);
},
removeEventListener: function (a, b) {
if ('finish' == a) {
var c = this._finishHandlers.indexOf(b);
c >= 0 && this._finishHandlers.splice(c, 1);
}
},
_fireEvents: function (a) {
if (this._isFinished) {
if (!this._finishedFlag) {
var b = new d(this, this._currentTime, a), c = this._finishHandlers.concat(this.onfinish ? [this.onfinish] : []);
setTimeout(function () {
c.forEach(function (a) {
a.call(b.target, b);
});
}, 0), this._finishedFlag = !0;
}
} else
this._finishedFlag = !1;
},
_tick: function (a, b) {
this._idle || this._paused || (null == this._startTime ? b && (this.startTime = a - this._currentTime / this.playbackRate) : this._isFinished || this._tickCurrentTime((a - this._startTime) * this.playbackRate)), b && (this._currentTimePending = !1, this._fireEvents(a));
},
get _needsTick() {
return this.playState in {
pending: 1,
running: 1
} || !this._finishedFlag;
}
};
}(c, d, f), function (a, b, c) {
function d(a) {
var b = j;
j = [], a < p.currentTime && (a = p.currentTime), h(a, !0), b.forEach(function (b) {
b[1](a);
}), g(), l = void 0;
}
function e(a, b) {
return a._sequenceNumber - b._sequenceNumber;
}
function f() {
this._animations = [], this.currentTime = window.performance && performance.now ? performance.now() : 0;
}
function g() {
o.forEach(function (a) {
a();
}), o.length = 0;
}
function h(a, c) {
n = !1;
var d = b.timeline;
d.currentTime = a, d._animations.sort(e), m = !1;
var f = d._animations;
d._animations = [];
var g = [], h = [];
f = f.filter(function (b) {
b._tick(a, c), b._inEffect ? h.push(b._effect) : g.push(b._effect), b._needsTick && (m = !0);
var d = b._inEffect || b._needsTick;
return b._inTimeline = d, d;
}), o.push.apply(o, g), o.push.apply(o, h), d._animations.push.apply(d._animations, f), m && requestAnimationFrame(function () {
});
}
var i = window.requestAnimationFrame, j = [], k = 0;
window.requestAnimationFrame = function (a) {
var b = k++;
return 0 == j.length && i(d), j.push([
b,
a
]), b;
}, window.cancelAnimationFrame = function (a) {
j.forEach(function (b) {
b[0] == a && (b[1] = function () {
});
});
}, f.prototype = {
_play: function (c) {
c._timing = a.normalizeTimingInput(c.timing);
var d = new b.Animation(c);
return d._idle = !1, d._timeline = this, this._animations.push(d), b.restart(), b.invalidateEffects(), d;
}
};
var l = void 0, m = !1, n = !1;
b.restart = function () {
return m || (m = !0, requestAnimationFrame(function () {
}), n = !0), n;
}, b.invalidateEffects = function () {
h(b.timeline.currentTime, !1), g();
};
var o = [], p = new f();
b.timeline = p;
}(c, d, f), function (a) {
function b(a, b) {
var c = a.exec(b);
return c ? (c = a.ignoreCase ? c[0].toLowerCase() : c[0], [
c,
b.substr(c.length)
]) : void 0;
}
function c(a, b) {
b = b.replace(/^\s*/, '');
var c = a(b);
return c ? [
c[0],
c[1].replace(/^\s*/, '')
] : void 0;
}
function d(a, d, e) {
a = c.bind(null, a);
for (var f = [];;) {
var g = a(e);
if (!g)
return [
f,
e
];
if (f.push(g[0]), e = g[1], g = b(d, e), !g || '' == g[1])
return [
f,
e
];
e = g[1];
}
}
function e(a, b) {
for (var c = 0, d = 0; d < b.length && (!/\s|,/.test(b[d]) || 0 != c); d++)
if ('(' == b[d])
c++;
else if (')' == b[d] && (c--, 0 == c && d++, 0 >= c))
break;
var e = a(b.substr(0, d));
return void 0 == e ? void 0 : [
e,
b.substr(d)
];
}
function f(a, b) {
for (var c = a, d = b; c && d;)
c > d ? c %= d : d %= c;
return c = a * b / (c + d);
}
function g(a) {
return function (b) {
var c = a(b);
return c && (c[0] = void 0), c;
};
}
function h(a, b) {
return function (c) {
var d = a(c);
return d ? d : [
b,
c
];
};
}
function i(b, c) {
for (var d = [], e = 0; e < b.length; e++) {
var f = a.consumeTrimmed(b[e], c);
if (!f || '' == f[0])
return;
void 0 !== f[0] && d.push(f[0]), c = f[1];
}
return '' == c ? d : void 0;
}
function j(a, b, c, d, e) {
for (var g = [], h = [], i = [], j = f(d.length, e.length), k = 0; j > k; k++) {
var l = b(d[k % d.length], e[k % e.length]);
if (!l)
return;
g.push(l[0]), h.push(l[1]), i.push(l[2]);
}
return [
g,
h,
function (b) {
var d = b.map(function (a, b) {
return i[b](a);
}).join(c);
return a ? a(d) : d;
}
];
}
function k(a, b, c) {
for (var d = [], e = [], f = [], g = 0, h = 0; h < c.length; h++)
if ('function' == typeof c[h]) {
var i = c[h](a[g], b[g++]);
d.push(i[0]), e.push(i[1]), f.push(i[2]);
} else
!function (a) {
d.push(!1), e.push(!1), f.push(function () {
return c[a];
});
}(h);
return [
d,
e,
function (a) {
for (var b = '', c = 0; c < a.length; c++)
b += f[c](a[c]);
return b;
}
];
}
a.consumeToken = b, a.consumeTrimmed = c, a.consumeRepeated = d, a.consumeParenthesised = e, a.ignore = g, a.optional = h, a.consumeList = i, a.mergeNestedRepeated = j.bind(null, null), a.mergeWrappedNestedRepeated = j, a.mergeList = k;
}(d), function (a) {
function b(b) {
function c(b) {
var c = a.consumeToken(/^inset/i, b);
if (c)
return d.inset = !0, c;
var c = a.consumeLengthOrPercent(b);
if (c)
return d.lengths.push(c[0]), c;
var c = a.consumeColor(b);
return c ? (d.color = c[0], c) : void 0;
}
var d = {
inset: !1,
lengths: [],
color: null
}, e = a.consumeRepeated(c, /^/, b);
return e && e[0].length ? [
d,
e[1]
] : void 0;
}
function c(c) {
var d = a.consumeRepeated(b, /^,/, c);
return d && '' == d[1] ? d[0] : void 0;
}
function d(b, c) {
for (; b.lengths.length < Math.max(b.lengths.length, c.lengths.length);)
b.lengths.push({ px: 0 });
for (; c.lengths.length < Math.max(b.lengths.length, c.lengths.length);)
c.lengths.push({ px: 0 });
if (b.inset == c.inset && !!b.color == !!c.color) {
for (var d, e = [], f = [
[],
0
], g = [
[],
0
], h = 0; h < b.lengths.length; h++) {
var i = a.mergeDimensions(b.lengths[h], c.lengths[h], 2 == h);
f[0].push(i[0]), g[0].push(i[1]), e.push(i[2]);
}
if (b.color && c.color) {
var j = a.mergeColors(b.color, c.color);
f[1] = j[0], g[1] = j[1], d = j[2];
}
return [
f,
g,
function (a) {
for (var c = b.inset ? 'inset ' : ' ', f = 0; f < e.length; f++)
c += e[f](a[0][f]) + ' ';
return d && (c += d(a[1])), c;
}
];
}
}
function e(b, c, d, e) {
function f(a) {
return {
inset: a,
color: [
0,
0,
0,
0
],
lengths: [
{ px: 0 },
{ px: 0 },
{ px: 0 },
{ px: 0 }
]
};
}
for (var g = [], h = [], i = 0; i < d.length || i < e.length; i++) {
var j = d[i] || f(e[i].inset), k = e[i] || f(d[i].inset);
g.push(j), h.push(k);
}
return a.mergeNestedRepeated(b, c, g, h);
}
var f = e.bind(null, d, ', ');
a.addPropertiesHandler(c, f, [
'box-shadow',
'text-shadow'
]);
}(d), function (a, b) {
function c(a) {
return a.toFixed(3).replace('.000', '');
}
function d(a, b, c) {
return Math.min(b, Math.max(a, c));
}
function e(a) {
return /^\s*[-+]?(\d*\.)?\d+\s*$/.test(a) ? Number(a) : void 0;
}
function f(a, b) {
return [
a,
b,
c
];
}
function g(a, b) {
return 0 != a ? i(0, 1 / 0)(a, b) : void 0;
}
function h(a, b) {
return [
a,
b,
function (a) {
return Math.round(d(1, 1 / 0, a));
}
];
}
function i(a, b) {
return function (e, f) {
return [
e,
f,
function (e) {
return c(d(a, b, e));
}
];
};
}
function j(a, b) {
return [
a,
b,
Math.round
];
}
a.clamp = d, a.addPropertiesHandler(e, i(0, 1 / 0), [
'border-image-width',
'line-height'
]), a.addPropertiesHandler(e, i(0, 1), [
'opacity',
'shape-image-threshold'
]), a.addPropertiesHandler(e, g, [
'flex-grow',
'flex-shrink'
]), a.addPropertiesHandler(e, h, [
'orphans',
'widows'
]), a.addPropertiesHandler(e, j, ['z-index']), a.parseNumber = e, a.mergeNumbers = f, a.numberToString = c;
}(d, f), function (a, b) {
function c(a, b) {
return 'visible' == a || 'visible' == b ? [
0,
1,
function (c) {
return 0 >= c ? a : c >= 1 ? b : 'visible';
}
] : void 0;
}
a.addPropertiesHandler(String, c, ['visibility']);
}(d), function (a, b) {
function c(a) {
a = a.trim(), f.fillStyle = '#000', f.fillStyle = a;
var b = f.fillStyle;
if (f.fillStyle = '#fff', f.fillStyle = a, b == f.fillStyle) {
f.fillRect(0, 0, 1, 1);
var c = f.getImageData(0, 0, 1, 1).data;
f.clearRect(0, 0, 1, 1);
var d = c[3] / 255;
return [
c[0] * d,
c[1] * d,
c[2] * d,
d
];
}
}
function d(b, c) {
return [
b,
c,
function (b) {
function c(a) {
return Math.max(0, Math.min(255, a));
}
if (b[3])
for (var d = 0; 3 > d; d++)
b[d] = Math.round(c(b[d] / b[3]));
return b[3] = a.numberToString(a.clamp(0, 1, b[3])), 'rgba(' + b.join(',') + ')';
}
];
}
var e = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
e.width = e.height = 1;
var f = e.getContext('2d');
a.addPropertiesHandler(c, d, [
'background-color',
'border-bottom-color',
'border-left-color',
'border-right-color',
'border-top-color',
'color',
'outline-color',
'text-decoration-color'
]), a.consumeColor = a.consumeParenthesised.bind(null, c), a.mergeColors = d;
}(d, f), function (a, b) {
function c(a, b) {
if (b = b.trim().toLowerCase(), '0' == b && 'px'.search(a) >= 0)
return { px: 0 };
if (/^[^(]*$|^calc/.test(b)) {
b = b.replace(/calc\(/g, '(');
var c = {};
b = b.replace(a, function (a) {
return c[a] = null, 'U' + a;
});
for (var d = 'U(' + a.source + ')', e = b.replace(/[-+]?(\d*\.)?\d+/g, 'N').replace(new RegExp('N' + d, 'g'), 'D').replace(/\s[+-]\s/g, 'O').replace(/\s/g, ''), f = [
/N\*(D)/g,
/(N|D)[*\/]N/g,
/(N|D)O\1/g,
/\((N|D)\)/g
], g = 0; g < f.length;)
f[g].test(e) ? (e = e.replace(f[g], '$1'), g = 0) : g++;
if ('D' == e) {
for (var h in c) {
var i = eval(b.replace(new RegExp('U' + h, 'g'), '').replace(new RegExp(d, 'g'), '*0'));
if (!isFinite(i))
return;
c[h] = i;
}
return c;
}
}
}
function d(a, b) {
return e(a, b, !0);
}
function e(b, c, d) {
var e, f = [];
for (e in b)
f.push(e);
for (e in c)
f.indexOf(e) < 0 && f.push(e);
return b = f.map(function (a) {
return b[a] || 0;
}), c = f.map(function (a) {
return c[a] || 0;
}), [
b,
c,
function (b) {
var c = b.map(function (c, e) {
return 1 == b.length && d && (c = Math.max(c, 0)), a.numberToString(c) + f[e];
}).join(' + ');
return b.length > 1 ? 'calc(' + c + ')' : c;
}
];
}
var f = 'px|em|ex|ch|rem|vw|vh|vmin|vmax|cm|mm|in|pt|pc', g = c.bind(null, new RegExp(f, 'g')), h = c.bind(null, new RegExp(f + '|%', 'g')), i = c.bind(null, /deg|rad|grad|turn/g);
a.parseLength = g, a.parseLengthOrPercent = h, a.consumeLengthOrPercent = a.consumeParenthesised.bind(null, h), a.parseAngle = i, a.mergeDimensions = e;
var j = a.consumeParenthesised.bind(null, g), k = a.consumeRepeated.bind(void 0, j, /^/), l = a.consumeRepeated.bind(void 0, k, /^,/);
a.consumeSizePairList = l;
var m = function (a) {
var b = l(a);
return b && '' == b[1] ? b[0] : void 0;
}, n = a.mergeNestedRepeated.bind(void 0, d, ' '), o = a.mergeNestedRepeated.bind(void 0, n, ',');
a.mergeNonNegativeSizePair = n, a.addPropertiesHandler(m, o, ['background-size']), a.addPropertiesHandler(h, d, [
'border-bottom-width',
'border-image-width',
'border-left-width',
'border-right-width',
'border-top-width',
'flex-basis',
'font-size',
'height',
'line-height',
'max-height',
'max-width',
'outline-width',
'width'
]), a.addPropertiesHandler(h, e, [
'border-bottom-left-radius',
'border-bottom-right-radius',
'border-top-left-radius',
'border-top-right-radius',
'bottom',
'left',
'letter-spacing',
'margin-bottom',
'margin-left',
'margin-right',
'margin-top',
'min-height',
'min-width',
'outline-offset',
'padding-bottom',
'padding-left',
'padding-right',
'padding-top',
'perspective',
'right',
'shape-margin',
'text-indent',
'top',
'vertical-align',
'word-spacing'
]);
}(d, f), function (a, b) {
function c(b) {
return a.consumeLengthOrPercent(b) || a.consumeToken(/^auto/, b);
}
function d(b) {
var d = a.consumeList([
a.ignore(a.consumeToken.bind(null, /^rect/)),
a.ignore(a.consumeToken.bind(null, /^\(/)),
a.consumeRepeated.bind(null, c, /^,/),
a.ignore(a.consumeToken.bind(null, /^\)/))
], b);
return d && 4 == d[0].length ? d[0] : void 0;
}
function e(b, c) {
return 'auto' == b || 'auto' == c ? [
!0,
!1,
function (d) {
var e = d ? b : c;
if ('auto' == e)
return 'auto';
var f = a.mergeDimensions(e, e);
return f[2](f[0]);
}
] : a.mergeDimensions(b, c);
}
function f(a) {
return 'rect(' + a + ')';
}
var g = a.mergeWrappedNestedRepeated.bind(null, f, e, ', ');
a.parseBox = d, a.mergeBoxes = g, a.addPropertiesHandler(d, g, ['clip']);
}(d, f), function (a, b) {
function c(a) {
return function (b) {
var c = 0;
return a.map(function (a) {
return a === k ? b[c++] : a;
});
};
}
function d(a) {
return a;
}
function e(b) {
if (b = b.toLowerCase().trim(), 'none' == b)
return [];
for (var c, d = /\s*(\w+)\(([^)]*)\)/g, e = [], f = 0; c = d.exec(b);) {
if (c.index != f)
return;
f = c.index + c[0].length;
var g = c[1], h = n[g];
if (!h)
return;
var i = c[2].split(','), j = h[0];
if (j.length < i.length)
return;
for (var k = [], o = 0; o < j.length; o++) {
var p, q = i[o], r = j[o];
if (p = q ? {
A: function (b) {
return '0' == b.trim() ? m : a.parseAngle(b);
},
N: a.parseNumber,
T: a.parseLengthOrPercent,
L: a.parseLength
}[r.toUpperCase()](q) : {
a: m,
n: k[0],
t: l
}[r], void 0 === p)
return;
k.push(p);
}
if (e.push({
t: g,
d: k
}), d.lastIndex == b.length)
return e;
}
}
function f(a) {
return a.toFixed(6).replace('.000000', '');
}
function g(b, c) {
if (b.decompositionPair !== c) {
b.decompositionPair = c;
var d = a.makeMatrixDecomposition(b);
}
if (c.decompositionPair !== b) {
c.decompositionPair = b;
var e = a.makeMatrixDecomposition(c);
}
return null == d[0] || null == e[0] ? [
[!1],
[!0],
function (a) {
return a ? c[0].d : b[0].d;
}
] : (d[0].push(0), e[0].push(1), [
d,
e,
function (b) {
var c = a.quat(d[0][3], e[0][3], b[5]), g = a.composeMatrix(b[0], b[1], b[2], c, b[4]), h = g.map(f).join(',');
return h;
}
]);
}
function h(a) {
return a.replace(/[xy]/, '');
}
function i(a) {
return a.replace(/(x|y|z|3d)?$/, '3d');
}
function j(b, c) {
var d = a.makeMatrixDecomposition && !0, e = !1;
if (!b.length || !c.length) {
b.length || (e = !0, b = c, c = []);
for (var f = 0; f < b.length; f++) {
var j = b[f].t, k = b[f].d, l = 'scale' == j.substr(0, 5) ? 1 : 0;
c.push({
t: j,
d: k.map(function (a) {
if ('number' == typeof a)
return l;
var b = {};
for (var c in a)
b[c] = l;
return b;
})
});
}
}
var m = function (a, b) {
return 'perspective' == a && 'perspective' == b || ('matrix' == a || 'matrix3d' == a) && ('matrix' == b || 'matrix3d' == b);
}, o = [], p = [], q = [];
if (b.length != c.length) {
if (!d)
return;
var r = g(b, c);
o = [r[0]], p = [r[1]], q = [[
'matrix',
[r[2]]
]];
} else
for (var f = 0; f < b.length; f++) {
var j, s = b[f].t, t = c[f].t, u = b[f].d, v = c[f].d, w = n[s], x = n[t];
if (m(s, t)) {
if (!d)
return;
var r = g([b[f]], [c[f]]);
o.push(r[0]), p.push(r[1]), q.push([
'matrix',
[r[2]]
]);
} else {
if (s == t)
j = s;
else if (w[2] && x[2] && h(s) == h(t))
j = h(s), u = w[2](u), v = x[2](v);
else {
if (!w[1] || !x[1] || i(s) != i(t)) {
if (!d)
return;
var r = g(b, c);
o = [r[0]], p = [r[1]], q = [[
'matrix',
[r[2]]
]];
break;
}
j = i(s), u = w[1](u), v = x[1](v);
}
for (var y = [], z = [], A = [], B = 0; B < u.length; B++) {
var C = 'number' == typeof u[B] ? a.mergeNumbers : a.mergeDimensions, r = C(u[B], v[B]);
y[B] = r[0], z[B] = r[1], A.push(r[2]);
}
o.push(y), p.push(z), q.push([
j,
A
]);
}
}
if (e) {
var D = o;
o = p, p = D;
}
return [
o,
p,
function (a) {
return a.map(function (a, b) {
var c = a.map(function (a, c) {
return q[b][1][c](a);
}).join(',');
return 'matrix' == q[b][0] && 16 == c.split(',').length && (q[b][0] = 'matrix3d'), q[b][0] + '(' + c + ')';
}).join(' ');
}
];
}
var k = null, l = { px: 0 }, m = { deg: 0 }, n = {
matrix: [
'NNNNNN',
[
k,
k,
0,
0,
k,
k,
0,
0,
0,
0,
1,
0,
k,
k,
0,
1
],
d
],
matrix3d: [
'NNNNNNNNNNNNNNNN',
d
],
rotate: ['A'],
rotatex: ['A'],
rotatey: ['A'],
rotatez: ['A'],
rotate3d: ['NNNA'],
perspective: ['L'],
scale: [
'Nn',
c([
k,
k,
1
]),
d
],
scalex: [
'N',
c([
k,
1,
1
]),
c([
k,
1
])
],
scaley: [
'N',
c([
1,
k,
1
]),
c([
1,
k
])
],
scalez: [
'N',
c([
1,
1,
k
])
],
scale3d: [
'NNN',
d
],
skew: [
'Aa',
null,
d
],
skewx: [
'A',
null,
c([
k,
m
])
],
skewy: [
'A',
null,
c([
m,
k
])
],
translate: [
'Tt',
c([
k,
k,
l
]),
d
],
translatex: [
'T',
c([
k,
l,
l
]),
c([
k,
l
])
],
translatey: [
'T',
c([
l,
k,
l
]),
c([
l,
k
])
],
translatez: [
'L',
c([
l,
l,
k
])
],
translate3d: [
'TTL',
d
]
};
a.addPropertiesHandler(e, j, ['transform']);
}(d, f), function (a, b) {
function c(a, b) {
b.concat([a]).forEach(function (b) {
b in document.documentElement.style && (d[a] = b);
});
}
var d = {};
c('transform', [
'webkitTransform',
'msTransform'
]), c('transformOrigin', ['webkitTransformOrigin']), c('perspective', ['webkitPerspective']), c('perspectiveOrigin', ['webkitPerspectiveOrigin']), a.propertyName = function (a) {
return d[a] || a;
};
}(d, f);
}(), !function () {
if (void 0 === document.createElement('div').animate([]).oncancel) {
var a;
if (window.performance && performance.now)
var a = function () {
return performance.now();
};
else
var a = function () {
return Date.now();
};
var b = function (a, b, c) {
this.target = a, this.currentTime = b, this.timelineTime = c, this.type = 'cancel', this.bubbles = !1, this.cancelable = !1, this.currentTarget = a, this.defaultPrevented = !1, this.eventPhase = Event.AT_TARGET, this.timeStamp = Date.now();
}, c = window.Element.prototype.animate;
window.Element.prototype.animate = function (d, e) {
var f = c.call(this, d, e);
f._cancelHandlers = [], f.oncancel = null;
var g = f.cancel;
f.cancel = function () {
g.call(this);
var c = new b(this, null, a()), d = this._cancelHandlers.concat(this.oncancel ? [this.oncancel] : []);
setTimeout(function () {
d.forEach(function (a) {
a.call(c.target, c);
});
}, 0);
};
var h = f.addEventListener;
f.addEventListener = function (a, b) {
'function' == typeof b && 'cancel' == a ? this._cancelHandlers.push(b) : h.call(this, a, b);
};
var i = f.removeEventListener;
return f.removeEventListener = function (a, b) {
if ('cancel' == a) {
var c = this._cancelHandlers.indexOf(b);
c >= 0 && this._cancelHandlers.splice(c, 1);
} else
i.call(this, a, b);
}, f;
};
}
}(), function (a) {
var b = document.documentElement, c = null, d = !1;
try {
var e = getComputedStyle(b).getPropertyValue('opacity'), f = '0' == e ? '1' : '0';
c = b.animate({
opacity: [
f,
f
]
}, { duration: 1 }), c.currentTime = 0, d = getComputedStyle(b).getPropertyValue('opacity') == f;
} catch (g) {
} finally {
c && c.cancel();
}
if (!d) {
var h = window.Element.prototype.animate;
window.Element.prototype.animate = function (b, c) {
return window.Symbol && Symbol.iterator && Array.prototype.from && b[Symbol.iterator] && (b = Array.from(b)), Array.isArray(b) || null === b || (b = a.convertToArrayForm(b)), h.call(this, b, c);
};
}
}(c), !function (a, b, c) {
function d(a) {
var b = window.document.timeline;
b.currentTime = a, b._discardAnimations(), 0 == b._animations.length ? f = !1 : requestAnimationFrame(d);
}
var e = window.requestAnimationFrame;
window.requestAnimationFrame = function (a) {
return e(function (b) {
window.document.timeline._updateAnimationsPromises(), a(b), window.document.timeline._updateAnimationsPromises();
});
}, b.AnimationTimeline = function () {
this._animations = [], this.currentTime = void 0;
}, b.AnimationTimeline.prototype = {
getAnimations: function () {
return this._discardAnimations(), this._animations.slice();
},
_updateAnimationsPromises: function () {
b.animationsWithPromises = b.animationsWithPromises.filter(function (a) {
return a._updatePromises();
});
},
_discardAnimations: function () {
this._updateAnimationsPromises(), this._animations = this._animations.filter(function (a) {
return 'finished' != a.playState && 'idle' != a.playState;
});
},
_play: function (a) {
var c = new b.Animation(a, this);
return this._animations.push(c), b.restartWebAnimationsNextTick(), c._updatePromises(), c._animation.play(), c._updatePromises(), c;
},
play: function (a) {
return a && a.remove(), this._play(a);
}
};
var f = !1;
b.restartWebAnimationsNextTick = function () {
f || (f = !0, requestAnimationFrame(d));
};
var g = new b.AnimationTimeline();
b.timeline = g;
try {
Object.defineProperty(window.document, 'timeline', {
configurable: !0,
get: function () {
return g;
}
});
} catch (h) {
}
try {
window.document.timeline = g;
} catch (h) {
}
}(c, e, f), function (a, b, c) {
b.animationsWithPromises = [], b.Animation = function (b, c) {
if (this.id = '', b && b._id && (this.id = b._id), this.effect = b, b && (b._animation = this), !c)
throw new Error('Animation with null timeline is not supported');
this._timeline = c, this._sequenceNumber = a.sequenceNumber++, this._holdTime = 0, this._paused = !1, this._isGroup = !1, this._animation = null, this._childAnimations = [], this._callback = null, this._oldPlayState = 'idle', this._rebuildUnderlyingAnimation(), this._animation.cancel(), this._updatePromises();
}, b.Animation.prototype = {
_updatePromises: function () {
var a = this._oldPlayState, b = this.playState;
return this._readyPromise && b !== a && ('idle' == b ? (this._rejectReadyPromise(), this._readyPromise = void 0) : 'pending' == a ? this._resolveReadyPromise() : 'pending' == b && (this._readyPromise = void 0)), this._finishedPromise && b !== a && ('idle' == b ? (this._rejectFinishedPromise(), this._finishedPromise = void 0) : 'finished' == b ? this._resolveFinishedPromise() : 'finished' == a && (this._finishedPromise = void 0)), this._oldPlayState = this.playState, this._readyPromise || this._finishedPromise;
},
_rebuildUnderlyingAnimation: function () {
this._updatePromises();
var a, c, d, e, f = !!this._animation;
f && (a = this.playbackRate, c = this._paused, d = this.startTime, e = this.currentTime, this._animation.cancel(), this._animation._wrapper = null, this._animation = null), (!this.effect || this.effect instanceof window.KeyframeEffect) && (this._animation = b.newUnderlyingAnimationForKeyframeEffect(this.effect), b.bindAnimationForKeyframeEffect(this)), (this.effect instanceof window.SequenceEffect || this.effect instanceof window.GroupEffect) && (this._animation = b.newUnderlyingAnimationForGroup(this.effect), b.bindAnimationForGroup(this)), this.effect && this.effect._onsample && b.bindAnimationForCustomEffect(this), f && (1 != a && (this.playbackRate = a), null !== d ? this.startTime = d : null !== e ? this.currentTime = e : null !== this._holdTime && (this.currentTime = this._holdTime), c && this.pause()), this._updatePromises();
},
_updateChildren: function () {
if (this.effect && 'idle' != this.playState) {
var a = this.effect._timing.delay;
this._childAnimations.forEach(function (c) {
this._arrangeChildren(c, a), this.effect instanceof window.SequenceEffect && (a += b.groupChildDuration(c.effect));
}.bind(this));
}
},
_setExternalAnimation: function (a) {
if (this.effect && this._isGroup)
for (var b = 0; b < this.effect.children.length; b++)
this.effect.children[b]._animation = a, this._childAnimations[b]._setExternalAnimation(a);
},
_constructChildAnimations: function () {
if (this.effect && this._isGroup) {
var a = this.effect._timing.delay;
this._removeChildAnimations(), this.effect.children.forEach(function (c) {
var d = window.document.timeline._play(c);
this._childAnimations.push(d), d.playbackRate = this.playbackRate, this._paused && d.pause(), c._animation = this.effect._animation, this._arrangeChildren(d, a), this.effect instanceof window.SequenceEffect && (a += b.groupChildDuration(c));
}.bind(this));
}
},
_arrangeChildren: function (a, b) {
null === this.startTime ? a.currentTime = this.currentTime - b / this.playbackRate : a.startTime !== this.startTime + b / this.playbackRate && (a.startTime = this.startTime + b / this.playbackRate);
},
get timeline() {
return this._timeline;
},
get playState() {
return this._animation ? this._animation.playState : 'idle';
},
get finished() {
return window.Promise ? (this._finishedPromise || (-1 == b.animationsWithPromises.indexOf(this) && b.animationsWithPromises.push(this), this._finishedPromise = new Promise(function (a, b) {
this._resolveFinishedPromise = function () {
a(this);
}, this._rejectFinishedPromise = function () {
b({
type: DOMException.ABORT_ERR,
name: 'AbortError'
});
};
}.bind(this)), 'finished' == this.playState && this._resolveFinishedPromise()), this._finishedPromise) : (console.warn('Animation Promises require JavaScript Promise constructor'), null);
},
get ready() {
return window.Promise ? (this._readyPromise || (-1 == b.animationsWithPromises.indexOf(this) && b.animationsWithPromises.push(this), this._readyPromise = new Promise(function (a, b) {
this._resolveReadyPromise = function () {
a(this);
}, this._rejectReadyPromise = function () {
b({
type: DOMException.ABORT_ERR,
name: 'AbortError'
});
};
}.bind(this)), 'pending' !== this.playState && this._resolveReadyPromise()), this._readyPromise) : (console.warn('Animation Promises require JavaScript Promise constructor'), null);
},
get onfinish() {
return this._animation.onfinish;
},
set onfinish(a) {
'function' == typeof a ? this._animation.onfinish = function (b) {
b.target = this, a.call(this, b);
}.bind(this) : this._animation.onfinish = a;
},
get oncancel() {
return this._animation.oncancel;
},
set oncancel(a) {
'function' == typeof a ? this._animation.oncancel = function (b) {
b.target = this, a.call(this, b);
}.bind(this) : this._animation.oncancel = a;
},
get currentTime() {
this._updatePromises();
var a = this._animation.currentTime;
return this._updatePromises(), a;
},
set currentTime(a) {
this._updatePromises(), this._animation.currentTime = isFinite(a) ? a : Math.sign(a) * Number.MAX_VALUE, this._register(), this._forEachChild(function (b, c) {
b.currentTime = a - c;
}), this._updatePromises();
},
get startTime() {
return this._animation.startTime;
},
set startTime(a) {
this._updatePromises(), this._animation.startTime = isFinite(a) ? a : Math.sign(a) * Number.MAX_VALUE, this._register(), this._forEachChild(function (b, c) {
b.startTime = a + c;
}), this._updatePromises();
},
get playbackRate() {
return this._animation.playbackRate;
},
set playbackRate(a) {
this._updatePromises();
var b = this.currentTime;
this._animation.playbackRate = a, this._forEachChild(function (b) {
b.playbackRate = a;
}), 'paused' != this.playState && 'idle' != this.playState && this.play(), null !== b && (this.currentTime = b), this._updatePromises();
},
play: function () {
this._updatePromises(), this._paused = !1, this._animation.play(), -1 == this._timeline._animations.indexOf(this) && this._timeline._animations.push(this), this._register(), b.awaitStartTime(this), this._forEachChild(function (a) {
var b = a.currentTime;
a.play(), a.currentTime = b;
}), this._updatePromises();
},
pause: function () {
this._updatePromises(), this.currentTime && (this._holdTime = this.currentTime), this._animation.pause(), this._register(), this._forEachChild(function (a) {
a.pause();
}), this._paused = !0, this._updatePromises();
},
finish: function () {
this._updatePromises(), this._animation.finish(), this._register(), this._updatePromises();
},
cancel: function () {
this._updatePromises(), this._animation.cancel(), this._register(), this._removeChildAnimations(), this._updatePromises();
},
reverse: function () {
this._updatePromises();
var a = this.currentTime;
this._animation.reverse(), this._forEachChild(function (a) {
a.reverse();
}), null !== a && (this.currentTime = a), this._updatePromises();
},
addEventListener: function (a, b) {
var c = b;
'function' == typeof b && (c = function (a) {
a.target = this, b.call(this, a);
}.bind(this), b._wrapper = c), this._animation.addEventListener(a, c);
},
removeEventListener: function (a, b) {
this._animation.removeEventListener(a, b && b._wrapper || b);
},
_removeChildAnimations: function () {
for (; this._childAnimations.length;)
this._childAnimations.pop().cancel();
},
_forEachChild: function (b) {
var c = 0;
if (this.effect.children && this._childAnimations.length < this.effect.children.length && this._constructChildAnimations(), this._childAnimations.forEach(function (a) {
b.call(this, a, c), this.effect instanceof window.SequenceEffect && (c += a.effect.activeDuration);
}.bind(this)), 'pending' != this.playState) {
var d = this.effect._timing, e = this.currentTime;
null !== e && (e = a.calculateTimeFraction(a.calculateActiveDuration(d), e, d)), (null == e || isNaN(e)) && this._removeChildAnimations();
}
}
}, window.Animation = b.Animation;
}(c, e, f), function (a, b, c) {
function d(b) {
this._frames = a.normalizeKeyframes(b);
}
function e() {
for (var a = !1; i.length;) {
var b = i.shift();
b._updateChildren(), a = !0;
}
return a;
}
var f = function (a) {
if (a._animation = void 0, a instanceof window.SequenceEffect || a instanceof window.GroupEffect)
for (var b = 0; b < a.children.length; b++)
f(a.children[b]);
};
b.removeMulti = function (a) {
for (var b = [], c = 0; c < a.length; c++) {
var d = a[c];
d._parent ? (-1 == b.indexOf(d._parent) && b.push(d._parent), d._parent.children.splice(d._parent.children.indexOf(d), 1), d._parent = null, f(d)) : d._animation && d._animation.effect == d && (d._animation.cancel(), d._animation.effect = new KeyframeEffect(null, []), d._animation._callback && (d._animation._callback._animation = null), d._animation._rebuildUnderlyingAnimation(), f(d));
}
for (c = 0; c < b.length; c++)
b[c]._rebuild();
}, b.KeyframeEffect = function (b, c, e, f) {
return this.target = b, this._parent = null, e = a.numericTimingToObject(e), this._timingInput = a.cloneTimingInput(e), this._timing = a.normalizeTimingInput(e), this.timing = a.makeTiming(e, !1, this), this.timing._effect = this, 'function' == typeof c ? (a.deprecated('Custom KeyframeEffect', '2015-06-22', 'Use KeyframeEffect.onsample instead.'), this._normalizedKeyframes = c) : this._normalizedKeyframes = new d(c), this._keyframes = c, this.activeDuration = a.calculateActiveDuration(this._timing), this._id = f, this;
}, b.KeyframeEffect.prototype = {
getFrames: function () {
return 'function' == typeof this._normalizedKeyframes ? this._normalizedKeyframes : this._normalizedKeyframes._frames;
},
set onsample(a) {
if ('function' == typeof this.getFrames())
throw new Error('Setting onsample on custom effect KeyframeEffect is not supported.');
this._onsample = a, this._animation && this._animation._rebuildUnderlyingAnimation();
},
get parent() {
return this._parent;
},
clone: function () {
if ('function' == typeof this.getFrames())
throw new Error('Cloning custom effects is not supported.');
var b = new KeyframeEffect(this.target, [], a.cloneTimingInput(this._timingInput), this._id);
return b._normalizedKeyframes = this._normalizedKeyframes, b._keyframes = this._keyframes, b;
},
remove: function () {
b.removeMulti([this]);
}
};
var g = Element.prototype.animate;
Element.prototype.animate = function (a, c) {
var d = '';
return c && c.id && (d = c.id), b.timeline._play(new b.KeyframeEffect(this, a, c, d));
};
var h = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
b.newUnderlyingAnimationForKeyframeEffect = function (a) {
if (a) {
var b = a.target || h, c = a._keyframes;
'function' == typeof c && (c = []);
var d = a._timingInput;
d.id = a._id;
} else
var b = h, c = [], d = 0;
return g.apply(b, [
c,
d
]);
}, b.bindAnimationForKeyframeEffect = function (a) {
a.effect && 'function' == typeof a.effect._normalizedKeyframes && b.bindAnimationForCustomEffect(a);
};
var i = [];
b.awaitStartTime = function (a) {
null === a.startTime && a._isGroup && (0 == i.length && requestAnimationFrame(e), i.push(a));
};
var j = window.getComputedStyle;
Object.defineProperty(window, 'getComputedStyle', {
configurable: !0,
enumerable: !0,
value: function () {
window.document.timeline._updateAnimationsPromises();
var a = j.apply(this, arguments);
return e() && (a = j.apply(this, arguments)), window.document.timeline._updateAnimationsPromises(), a;
}
}), window.KeyframeEffect = b.KeyframeEffect, window.Element.prototype.getAnimations = function () {
return document.timeline.getAnimations().filter(function (a) {
return null !== a.effect && a.effect.target == this;
}.bind(this));
};
}(c, e, f), function (a, b, c) {
function d(a) {
a._registered || (a._registered = !0, g.push(a), h || (h = !0, requestAnimationFrame(e)));
}
function e(a) {
var b = g;
g = [], b.sort(function (a, b) {
return a._sequenceNumber - b._sequenceNumber;
}), b = b.filter(function (a) {
a();
var b = a._animation ? a._animation.playState : 'idle';
return 'running' != b && 'pending' != b && (a._registered = !1), a._registered;
}), g.push.apply(g, b), g.length ? (h = !0, requestAnimationFrame(e)) : h = !1;
}
var f = (document.createElementNS('http://www.w3.org/1999/xhtml', 'div'), 0);
b.bindAnimationForCustomEffect = function (b) {
var c, e = b.effect.target, g = 'function' == typeof b.effect.getFrames();
c = g ? b.effect.getFrames() : b.effect._onsample;
var h = b.effect.timing, i = null;
h = a.normalizeTimingInput(h);
var j = function () {
var d = j._animation ? j._animation.currentTime : null;
null !== d && (d = a.calculateTimeFraction(a.calculateActiveDuration(h), d, h), isNaN(d) && (d = null)), d !== i && (g ? c(d, e, b.effect) : c(d, b.effect, b.effect._animation)), i = d;
};
j._animation = b, j._registered = !1, j._sequenceNumber = f++, b._callback = j, d(j);
};
var g = [], h = !1;
b.Animation.prototype._register = function () {
this._callback && d(this._callback);
};
}(c, e, f), function (a, b, c) {
function d(a) {
return a._timing.delay + a.activeDuration + a._timing.endDelay;
}
function e(b, c, d) {
this._id = d, this._parent = null, this.children = b || [], this._reparent(this.children), c = a.numericTimingToObject(c), this._timingInput = a.cloneTimingInput(c), this._timing = a.normalizeTimingInput(c, !0), this.timing = a.makeTiming(c, !0, this), this.timing._effect = this, 'auto' === this._timing.duration && (this._timing.duration = this.activeDuration);
}
window.SequenceEffect = function () {
e.apply(this, arguments);
}, window.GroupEffect = function () {
e.apply(this, arguments);
}, e.prototype = {
_isAncestor: function (a) {
for (var b = this; null !== b;) {
if (b == a)
return !0;
b = b._parent;
}
return !1;
},
_rebuild: function () {
for (var a = this; a;)
'auto' === a.timing.duration && (a._timing.duration = a.activeDuration), a = a._parent;
this._animation && this._animation._rebuildUnderlyingAnimation();
},
_reparent: function (a) {
b.removeMulti(a);
for (var c = 0; c < a.length; c++)
a[c]._parent = this;
},
_putChild: function (a, b) {
for (var c = b ? 'Cannot append an ancestor or self' : 'Cannot prepend an ancestor or self', d = 0; d < a.length; d++)
if (this._isAncestor(a[d]))
throw {
type: DOMException.HIERARCHY_REQUEST_ERR,
name: 'HierarchyRequestError',
message: c
};
for (var d = 0; d < a.length; d++)
b ? this.children.push(a[d]) : this.children.unshift(a[d]);
this._reparent(a), this._rebuild();
},
append: function () {
this._putChild(arguments, !0);
},
prepend: function () {
this._putChild(arguments, !1);
},
get parent() {
return this._parent;
},
get firstChild() {
return this.children.length ? this.children[0] : null;
},
get lastChild() {
return this.children.length ? this.children[this.children.length - 1] : null;
},
clone: function () {
for (var b = a.cloneTimingInput(this._timingInput), c = [], d = 0; d < this.children.length; d++)
c.push(this.children[d].clone());
return this instanceof GroupEffect ? new GroupEffect(c, b) : new SequenceEffect(c, b);
},
remove: function () {
b.removeMulti([this]);
}
}, window.SequenceEffect.prototype = Object.create(e.prototype), Object.defineProperty(window.SequenceEffect.prototype, 'activeDuration', {
get: function () {
var a = 0;
return this.children.forEach(function (b) {
a += d(b);
}), Math.max(a, 0);
}
}), window.GroupEffect.prototype = Object.create(e.prototype), Object.defineProperty(window.GroupEffect.prototype, 'activeDuration', {
get: function () {
var a = 0;
return this.children.forEach(function (b) {
a = Math.max(a, d(b));
}), a;
}
}), b.newUnderlyingAnimationForGroup = function (c) {
var d, e = null, f = function (b) {
var c = d._wrapper;
return c && 'pending' != c.playState && c.effect ? null == b ? void c._removeChildAnimations() : 0 == b && c.playbackRate < 0 && (e || (e = a.normalizeTimingInput(c.effect.timing)), b = a.calculateTimeFraction(a.calculateActiveDuration(e), -1, e), isNaN(b) || null == b) ? (c._forEachChild(function (a) {
a.currentTime = -1;
}), void c._removeChildAnimations()) : void 0 : void 0;
}, g = new KeyframeEffect(null, [], c._timing, c._id);
return g.onsample = f, d = b.timeline._play(g);
}, b.bindAnimationForGroup = function (a) {
a._animation._wrapper = a, a._isGroup = !0, b.awaitStartTime(a), a._constructChildAnimations(), a._setExternalAnimation(a);
}, b.groupChildDuration = d;
}(c, e, f), b['true'] = a;
}({}, function () {
return this;
}());
Polymer({
is: 'cascaded-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
this._animations = [];
var nodes = config.nodes;
var effects = [];
var nodeDelay = config.nodeDelay || 50;
config.timing = config.timing || {};
config.timing.delay = config.timing.delay || 0;
var oldDelay = config.timing.delay;
var abortedConfigure;
for (var node, index = 0; node = nodes[index]; index++) {
config.timing.delay += nodeDelay;
config.node = node;
var animation = document.createElement(config.animation);
if (animation.isNeonAnimation) {
var effect = animation.configure(config);
this._animations.push(animation);
effects.push(effect);
} else {
console.warn(this.is + ':', config.animation, 'not found!');
abortedConfigure = true;
break;
}
}
config.timing.delay = oldDelay;
config.node = null;
if (abortedConfigure) {
return;
}
this._effect = new GroupEffect(effects);
return this._effect;
},
complete: function () {
for (var animation, index = 0; animation = this._animations[index]; index++) {
animation.complete(animation.config);
}
}
});
Polymer({
is: 'fade-in-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'opacity': '0' },
{ 'opacity': '1' }
], this.timingFromConfig(config));
return this._effect;
}
});
Polymer({
is: 'fade-out-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'opacity': '1' },
{ 'opacity': '0' }
], this.timingFromConfig(config));
return this._effect;
}
});
Polymer.NeonSharedElementAnimationBehaviorImpl = {
properties: { sharedElements: { type: Object } },
findSharedElements: function (config) {
var fromPage = config.fromPage;
var toPage = config.toPage;
if (!fromPage || !toPage) {
console.warn(this.is + ':', !fromPage ? 'fromPage' : 'toPage', 'is undefined!');
return null;
}
;
if (!fromPage.sharedElements || !toPage.sharedElements) {
console.warn(this.is + ':', 'sharedElements are undefined for', !fromPage.sharedElements ? fromPage : toPage);
return null;
}
;
var from = fromPage.sharedElements[config.id];
var to = toPage.sharedElements[config.id];
if (!from || !to) {
console.warn(this.is + ':', 'sharedElement with id', config.id, 'not found in', !from ? fromPage : toPage);
return null;
}
this.sharedElements = {
from: from,
to: to
};
return this.sharedElements;
}
};
Polymer.NeonSharedElementAnimationBehavior = [
Polymer.NeonAnimationBehavior,
Polymer.NeonSharedElementAnimationBehaviorImpl
];
Polymer({
is: 'hero-animation',
behaviors: [Polymer.NeonSharedElementAnimationBehavior],
configure: function (config) {
var shared = this.findSharedElements(config);
if (!shared) {
return;
}
var fromRect = shared.from.getBoundingClientRect();
var toRect = shared.to.getBoundingClientRect();
var deltaLeft = fromRect.left - toRect.left;
var deltaTop = fromRect.top - toRect.top;
var deltaWidth = fromRect.width / toRect.width;
var deltaHeight = fromRect.height / toRect.height;
this._effect = new KeyframeEffect(shared.to, [
{ 'transform': 'translate(' + deltaLeft + 'px,' + deltaTop + 'px) scale(' + deltaWidth + ',' + deltaHeight + ')' },
{ 'transform': 'none' }
], this.timingFromConfig(config));
this.setPrefixedProperty(shared.to, 'transformOrigin', '0 0');
shared.to.style.zIndex = 10000;
shared.from.style.visibility = 'hidden';
return this._effect;
},
complete: function (config) {
var shared = this.findSharedElements(config);
if (!shared) {
return null;
}
shared.to.style.zIndex = '';
shared.from.style.visibility = '';
}
});
Polymer({
is: 'opaque-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'opacity': '1' },
{ 'opacity': '1' }
], this.timingFromConfig(config));
node.style.opacity = '0';
return this._effect;
},
complete: function (config) {
config.node.style.opacity = '';
}
});
Polymer({
is: 'ripple-animation',
behaviors: [Polymer.NeonSharedElementAnimationBehavior],
configure: function (config) {
var shared = this.findSharedElements(config);
if (!shared) {
return null;
}
var translateX, translateY;
var toRect = shared.to.getBoundingClientRect();
if (config.gesture) {
translateX = config.gesture.x - (toRect.left + toRect.width / 2);
translateY = config.gesture.y - (toRect.top + toRect.height / 2);
} else {
var fromRect = shared.from.getBoundingClientRect();
translateX = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2);
translateY = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2);
}
var translate = 'translate(' + translateX + 'px,' + translateY + 'px)';
var size = Math.max(toRect.width + Math.abs(translateX) * 2, toRect.height + Math.abs(translateY) * 2);
var diameter = Math.sqrt(2 * size * size);
var scaleX = diameter / toRect.width;
var scaleY = diameter / toRect.height;
var scale = 'scale(' + scaleX + ',' + scaleY + ')';
this._effect = new KeyframeEffect(shared.to, [
{ 'transform': translate + ' scale(0)' },
{ 'transform': translate + ' ' + scale }
], this.timingFromConfig(config));
this.setPrefixedProperty(shared.to, 'transformOrigin', '50% 50%');
shared.to.style.borderRadius = '50%';
return this._effect;
},
complete: function () {
if (this.sharedElements) {
this.setPrefixedProperty(this.sharedElements.to, 'transformOrigin', '');
this.sharedElements.to.style.borderRadius = '';
}
}
});
Polymer({
is: 'reverse-ripple-animation',
behaviors: [Polymer.NeonSharedElementAnimationBehavior],
configure: function (config) {
var shared = this.findSharedElements(config);
if (!shared) {
return null;
}
var translateX, translateY;
var fromRect = shared.from.getBoundingClientRect();
if (config.gesture) {
translateX = config.gesture.x - (fromRect.left + fromRect.width / 2);
translateY = config.gesture.y - (fromRect.top + fromRect.height / 2);
} else {
var toRect = shared.to.getBoundingClientRect();
translateX = toRect.left + toRect.width / 2 - (fromRect.left + fromRect.width / 2);
translateY = toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2);
}
var translate = 'translate(' + translateX + 'px,' + translateY + 'px)';
var size = Math.max(fromRect.width + Math.abs(translateX) * 2, fromRect.height + Math.abs(translateY) * 2);
var diameter = Math.sqrt(2 * size * size);
var scaleX = diameter / fromRect.width;
var scaleY = diameter / fromRect.height;
var scale = 'scale(' + scaleX + ',' + scaleY + ')';
this._effect = new KeyframeEffect(shared.from, [
{ 'transform': translate + ' ' + scale },
{ 'transform': translate + ' scale(0)' }
], this.timingFromConfig(config));
this.setPrefixedProperty(shared.from, 'transformOrigin', '50% 50%');
shared.from.style.borderRadius = '50%';
return this._effect;
},
complete: function () {
if (this.sharedElements) {
this.setPrefixedProperty(this.sharedElements.from, 'transformOrigin', '');
this.sharedElements.from.style.borderRadius = '';
}
}
});
Polymer({
is: 'scale-down-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
var scaleProperty = 'scale(0, 0)';
if (config.axis === 'x') {
scaleProperty = 'scale(0, 1)';
} else if (config.axis === 'y') {
scaleProperty = 'scale(1, 0)';
}
this._effect = new KeyframeEffect(node, [
{ 'transform': 'scale(1,1)' },
{ 'transform': scaleProperty }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
}
return this._effect;
}
});
Polymer({
is: 'scale-up-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
var scaleProperty = 'scale(0)';
if (config.axis === 'x') {
scaleProperty = 'scale(0, 1)';
} else if (config.axis === 'y') {
scaleProperty = 'scale(1, 0)';
}
this._effect = new KeyframeEffect(node, [
{ 'transform': scaleProperty },
{ 'transform': 'scale(1, 1)' }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
}
return this._effect;
}
});
Polymer({
is: 'slide-from-left-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'transform': 'translateX(-100%)' },
{ 'transform': 'none' }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
} else {
this.setPrefixedProperty(node, 'transformOrigin', '0 50%');
}
return this._effect;
}
});
Polymer({
is: 'slide-from-right-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'transform': 'translateX(100%)' },
{ 'transform': 'none' }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
} else {
this.setPrefixedProperty(node, 'transformOrigin', '0 50%');
}
return this._effect;
}
});
Polymer({
is: 'slide-from-top-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'transform': 'translateY(-100%)' },
{ 'transform': 'translateY(0%)' }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
} else {
this.setPrefixedProperty(node, 'transformOrigin', '50% 0');
}
return this._effect;
}
});
Polymer({
is: 'slide-from-bottom-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'transform': 'translateY(100%)' },
{ 'transform': 'translateY(0)' }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
} else {
this.setPrefixedProperty(node, 'transformOrigin', '50% 0');
}
return this._effect;
}
});
Polymer({
is: 'slide-left-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'transform': 'none' },
{ 'transform': 'translateX(-100%)' }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
} else {
this.setPrefixedProperty(node, 'transformOrigin', '0 50%');
}
return this._effect;
}
});
Polymer({
is: 'slide-right-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'transform': 'none' },
{ 'transform': 'translateX(100%)' }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
} else {
this.setPrefixedProperty(node, 'transformOrigin', '0 50%');
}
return this._effect;
}
});
Polymer({
is: 'slide-up-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'transform': 'translate(0)' },
{ 'transform': 'translateY(-100%)' }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
} else {
this.setPrefixedProperty(node, 'transformOrigin', '50% 0');
}
return this._effect;
}
});
Polymer({
is: 'slide-down-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
this._effect = new KeyframeEffect(node, [
{ 'transform': 'translateY(0%)' },
{ 'transform': 'translateY(100%)' }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
} else {
this.setPrefixedProperty(node, 'transformOrigin', '50% 0');
}
return this._effect;
}
});
Polymer({
is: 'transform-animation',
behaviors: [Polymer.NeonAnimationBehavior],
configure: function (config) {
var node = config.node;
var transformFrom = config.transformFrom || 'none';
var transformTo = config.transformTo || 'none';
this._effect = new KeyframeEffect(node, [
{ 'transform': transformFrom },
{ 'transform': transformTo }
], this.timingFromConfig(config));
if (config.transformOrigin) {
this.setPrefixedProperty(node, 'transformOrigin', config.transformOrigin);
}
return this._effect;
}
});
Polymer({
is: 'px-page',
behaviors: [
Polymer.IronResizableBehavior,
Polymer.NeonAnimatableBehavior,
PageBehavior
],
properties: {
animationConfig: {
value: function () {
return {
'entry': {
name: 'fade-in-animation',
node: this
},
'exit': {
name: 'fade-out-animation',
node: this
}
};
}
},
title: {
type: String,
value: null
},
import: {
type: String,
notify: true,
value: null,
observer: '_tmplChanged'
},
active: {
type: Boolean,
value: false
},
main: {
type: Boolean,
value: false
},
dialog: {
type: Boolean,
value: false
},
query: { type: Object },
context: { type: Object },
fromPage: { type: Object },
route: { type: String },
url: { type: String },
pages: { type: Object },
container: { type: Object }
},
listeners: { 'neon-animation-finish': '_onNeonAnimationFinish' },
animate: function () {
this.playAnimation();
},
_onNeonAnimationFinish: function () {
console.log('animation done!');
},
get navbar() {
return Polymer.dom(this.$.navbarContent).getDistributedNodes()[0];
},
_pagesContainer: null,
attached: function () {
this.toggleClass('page');
if (this.navbar) {
if (this.parentNode && this.parentNode.localName === 'px-pages') {
this.pagesContainer = this.parentNode;
this.navbar.pagesContainer = this.pagesContainer;
this.listen(this.navbar, 'px-page-back', '_handleBack');
}
}
},
_handleBack: function (e) {
if (this.pagesContainer) {
this.pagesContainer.back();
}
}
});
Polymer({
is: 'px-pages',
behaviors: [
Polymer.IronResizableBehavior,
Polymer.NeonAnimationRunnerBehavior
],
listeners: { 'neon-animation-finish': '_onNeonAnimationFinish' },
animate: function () {
this.playAnimation();
},
_onNeonAnimationFinish: function () {
console.log('animation done!');
},
properties: {
animationConfig: {
value: function () {
return {
'entry': {
name: 'fade-in-animation',
node: this
},
'exit': {
name: 'fade-out-animation',
node: this
}
};
}
},
selected: {
type: Number,
reflectToAttribute: true,
notify: true,
observer: '_handleSelectedChange',
value: 0
},
selectedPage: {
type: Object,
notify: true
},
mainPage: { type: Object },
pages: {
type: Array,
value: function () {
return [];
}
},
selectedClass: {
type: String,
value: 'current'
},
updateHash: {
type: Boolean,
value: false
}
},
created: function () {
this._PageMap = {};
this._PageList = [];
},
attached: function () {
var _this = this;
if (!this.id) {
throw 'pages' + this.tagName + ' cannot be created without an id!';
}
this.async(function () {
this._init();
this.toggleClass('et-wrapper');
this.toggleClass('px-pages__wrapper');
this.gotoIndex(this.selected);
}, 1);
},
detached: function () {
this._log('detached');
},
_init: function () {
var self = this;
var pages = this.getPages();
this._pages = pages;
var len = pages.length;
for (var i = 0; i < len; i++) {
self._log('page', pages[i]);
self._addPage(pages[i]);
}
this.fire('px-page-ready');
},
_handleSelectedChange: function (index, oldIndex) {
var _this = this;
var _pages = this.getPages();
var prevPage = _pages[index - 1];
var currPage = _pages[index];
var nextPage = _pages[index + 1];
this._clearCurrent();
if (nextPage) {
_this._log('nextPage', nextPage);
_this.toggleClass('next', true, nextPage);
_this.toggleClass(_this.selectedClass, false, nextPage);
_this.toggleClass('previous', false, nextPage);
}
if (prevPage) {
_this._log('prevPage', prevPage);
_this.toggleClass(_this.selectedClass, false, prevPage);
_this.toggleClass('next', false, prevPage);
_this.toggleClass('previous', true, prevPage);
}
if (currPage) {
_this._log('currPage', _this.selectedClass, currPage);
currPage.nextPage = nextPage;
currPage.prevPage = prevPage;
_this.toggleClass('next', false, currPage);
_this.toggleClass('previous', false, currPage);
_this.toggleClass(_this.selectedClass, true, currPage);
_this.selectedPage = currPage;
_this.fire('px-page-change', currPage);
}
return currPage;
},
select: function (value) {
return this.goto(value);
},
goto: function (indexOrId) {
var p = null;
if (this._PageList[indexOrId]) {
p = this._PageList[indexOrId];
return this.gotoIndex(indexOrId);
} else if (this._PageMap[indexOrId]) {
p = this._PageMap[indexOrId];
return this.gotoIndex(this.indexOf(p));
} else {
console.log('Page', indexOrId, 'does not exist!');
return false;
}
},
_addPage: function (Page) {
if (Page.main) {
Page.toggleClass(this.selectedClass, true);
this.mainPage = Page;
}
Page.setAttribute('index', this._PageList.length.toString());
this.toggleClass('et-page', true, Page);
this._PageMap[Page.id] = Page;
Page.container = this;
this._PageList.push(Page);
this.fire('px-page-add', Page);
},
reset: function (selected) {
var self = this;
var _pages = this.getPages();
var len = _pages.length;
var p;
this._clearCurrent();
for (var i = 0; i < len; i++) {
p = _pages[i];
self._log('resetting', i, p);
this.toggleClass(self.selectedClass, false, p);
this.toggleClass('next', false, p);
this.toggleClass('previous', false, p);
}
this.selected = selected || 0;
this.toggleClass(self.selectedClass, true, _pages[this.selected]);
this.fire('px-page-reset');
},
gotoIndex: function (index) {
this._log('gotoIndex', index);
var _this = this;
var _pages = _this.getPages();
var p = _pages[index];
if (p) {
this.selected = this.indexOf(p);
return p;
} else {
return false;
}
},
indexOf: function (page) {
var i = this._pages.indexOf(page);
if (i > -1) {
return i;
} else {
return false;
}
},
gotoPage: function (id) {
this._log('gotoPage', id);
var index = 0;
var page = this._PageMap[id];
if (page) {
index = this.indexOf(page);
if (index > -1) {
this.selected = index;
return page;
} else {
return false;
}
} else {
return false;
}
},
_warn: function (type, message) {
},
_log: function (type, message) {
},
_clearCurrent: function () {
var self = this;
var _pages = this.getPages();
var len = _pages.length;
if (_pages) {
for (var i = 0; i < len; i++) {
self._log('_clearCurrent', self.selectedClass, _pages[i]);
self.toggleClass(self.selectedClass, false, _pages[i]);
}
}
},
getSelectedPage: function () {
return this._pages[this.selected];
},
getPrevious: function () {
if (this.selected === 0) {
return false;
}
return this._pages[this.selected - 1];
},
getNext: function () {
if (this.selected === this._pages.length - 1) {
return false;
}
return this._pages[this.selected + 1];
},
_updateHash: function () {
if (this.updateHash) {
window.location.hash = this.getCurrentPage().id;
}
},
current: function (index) {
this.selected = index || this.selected;
this._log('current', this.selected);
return this.gotoIndex(this.selected);
},
next: function () {
this._log('next', this.selected);
if (this.selected >= this.getPages().length - 1) {
if (this.loop) {
this.reset();
} else {
this.current();
}
this._warn('next', 'end of page stack!');
return;
} else {
this.selected++;
}
return this.current();
},
prev: function () {
if (this.selected <= 0) {
if (this.loop) {
this.reset(true);
} else {
this.current();
}
} else {
this.gotoIndex(this.selected - 1);
}
},
selectPrevious: function () {
return this.prev();
},
selectNext: function () {
return this.next();
},
getCurrent: function () {
return this._pages[this.selected];
},
back: function () {
this._log('back', this.selected);
return this.selected--;
},
getPages: function () {
this._pages = this.queryAllEffectiveChildren('px-page');
return this._pages;
}
});
var pxTableViewBehavior = {
ready: function () {
var template = Polymer.dom(this).querySelector('template');
}
};
!function (a, b, c, d) {
'use strict';
function e(a, b, c) {
return setTimeout(j(a, c), b);
}
function f(a, b, c) {
return Array.isArray(a) ? (g(a, c[b], c), !0) : !1;
}
function g(a, b, c) {
var e;
if (a)
if (a.forEach)
a.forEach(b, c);
else if (a.length !== d)
for (e = 0; e < a.length;)
b.call(c, a[e], e, a), e++;
else
for (e in a)
a.hasOwnProperty(e) && b.call(c, a[e], e, a);
}
function h(b, c, d) {
var e = 'DEPRECATED METHOD: ' + c + '\n' + d + ' AT \n';
return function () {
var c = new Error('get-stack-trace'), d = c && c.stack ? c.stack.replace(/^[^\(]+?[\n$]/gm, '').replace(/^\s+at\s+/gm, '').replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@') : 'Unknown Stack Trace', f = a.console && (a.console.warn || a.console.log);
return f && f.call(a.console, e, d), b.apply(this, arguments);
};
}
function i(a, b, c) {
var d, e = b.prototype;
d = a.prototype = Object.create(e), d.constructor = a, d._super = e, c && la(d, c);
}
function j(a, b) {
return function () {
return a.apply(b, arguments);
};
}
function k(a, b) {
return typeof a == oa ? a.apply(b ? b[0] || d : d, b) : a;
}
function l(a, b) {
return a === d ? b : a;
}
function m(a, b, c) {
g(q(b), function (b) {
a.addEventListener(b, c, !1);
});
}
function n(a, b, c) {
g(q(b), function (b) {
a.removeEventListener(b, c, !1);
});
}
function o(a, b) {
for (; a;) {
if (a == b)
return !0;
a = a.parentNode;
}
return !1;
}
function p(a, b) {
return a.indexOf(b) > -1;
}
function q(a) {
return a.trim().split(/\s+/g);
}
function r(a, b, c) {
if (a.indexOf && !c)
return a.indexOf(b);
for (var d = 0; d < a.length;) {
if (c && a[d][c] == b || !c && a[d] === b)
return d;
d++;
}
return -1;
}
function s(a) {
return Array.prototype.slice.call(a, 0);
}
function t(a, b, c) {
for (var d = [], e = [], f = 0; f < a.length;) {
var g = b ? a[f][b] : a[f];
r(e, g) < 0 && d.push(a[f]), e[f] = g, f++;
}
return c && (d = b ? d.sort(function (a, c) {
return a[b] > c[b];
}) : d.sort()), d;
}
function u(a, b) {
for (var c, e, f = b[0].toUpperCase() + b.slice(1), g = 0; g < ma.length;) {
if (c = ma[g], e = c ? c + f : b, e in a)
return e;
g++;
}
return d;
}
function v() {
return ua++;
}
function w(b) {
var c = b.ownerDocument || b;
return c.defaultView || c.parentWindow || a;
}
function x(a, b) {
var c = this;
this.manager = a, this.callback = b, this.element = a.element, this.target = a.options.inputTarget, this.domHandler = function (b) {
k(a.options.enable, [a]) && c.handler(b);
}, this.init();
}
function y(a) {
var b, c = a.options.inputClass;
return new (b = c ? c : xa ? M : ya ? P : wa ? R : L)(a, z);
}
function z(a, b, c) {
var d = c.pointers.length, e = c.changedPointers.length, f = b & Ea && d - e === 0, g = b & (Ga | Ha) && d - e === 0;
c.isFirst = !!f, c.isFinal = !!g, f && (a.session = {}), c.eventType = b, A(a, c), a.emit('hammer.input', c), a.recognize(c), a.session.prevInput = c;
}
function A(a, b) {
var c = a.session, d = b.pointers, e = d.length;
c.firstInput || (c.firstInput = D(b)), e > 1 && !c.firstMultiple ? c.firstMultiple = D(b) : 1 === e && (c.firstMultiple = !1);
var f = c.firstInput, g = c.firstMultiple, h = g ? g.center : f.center, i = b.center = E(d);
b.timeStamp = ra(), b.deltaTime = b.timeStamp - f.timeStamp, b.angle = I(h, i), b.distance = H(h, i), B(c, b), b.offsetDirection = G(b.deltaX, b.deltaY);
var j = F(b.deltaTime, b.deltaX, b.deltaY);
b.overallVelocityX = j.x, b.overallVelocityY = j.y, b.overallVelocity = qa(j.x) > qa(j.y) ? j.x : j.y, b.scale = g ? K(g.pointers, d) : 1, b.rotation = g ? J(g.pointers, d) : 0, b.maxPointers = c.prevInput ? b.pointers.length > c.prevInput.maxPointers ? b.pointers.length : c.prevInput.maxPointers : b.pointers.length, C(c, b);
var k = a.element;
o(b.srcEvent.target, k) && (k = b.srcEvent.target), b.target = k;
}
function B(a, b) {
var c = b.center, d = a.offsetDelta || {}, e = a.prevDelta || {}, f = a.prevInput || {};
b.eventType !== Ea && f.eventType !== Ga || (e = a.prevDelta = {
x: f.deltaX || 0,
y: f.deltaY || 0
}, d = a.offsetDelta = {
x: c.x,
y: c.y
}), b.deltaX = e.x + (c.x - d.x), b.deltaY = e.y + (c.y - d.y);
}
function C(a, b) {
var c, e, f, g, h = a.lastInterval || b, i = b.timeStamp - h.timeStamp;
if (b.eventType != Ha && (i > Da || h.velocity === d)) {
var j = b.deltaX - h.deltaX, k = b.deltaY - h.deltaY, l = F(i, j, k);
e = l.x, f = l.y, c = qa(l.x) > qa(l.y) ? l.x : l.y, g = G(j, k), a.lastInterval = b;
} else
c = h.velocity, e = h.velocityX, f = h.velocityY, g = h.direction;
b.velocity = c, b.velocityX = e, b.velocityY = f, b.direction = g;
}
function D(a) {
for (var b = [], c = 0; c < a.pointers.length;)
b[c] = {
clientX: pa(a.pointers[c].clientX),
clientY: pa(a.pointers[c].clientY)
}, c++;
return {
timeStamp: ra(),
pointers: b,
center: E(b),
deltaX: a.deltaX,
deltaY: a.deltaY
};
}
function E(a) {
var b = a.length;
if (1 === b)
return {
x: pa(a[0].clientX),
y: pa(a[0].clientY)
};
for (var c = 0, d = 0, e = 0; b > e;)
c += a[e].clientX, d += a[e].clientY, e++;
return {
x: pa(c / b),
y: pa(d / b)
};
}
function F(a, b, c) {
return {
x: b / a || 0,
y: c / a || 0
};
}
function G(a, b) {
return a === b ? Ia : qa(a) >= qa(b) ? 0 > a ? Ja : Ka : 0 > b ? La : Ma;
}
function H(a, b, c) {
c || (c = Qa);
var d = b[c[0]] - a[c[0]], e = b[c[1]] - a[c[1]];
return Math.sqrt(d * d + e * e);
}
function I(a, b, c) {
c || (c = Qa);
var d = b[c[0]] - a[c[0]], e = b[c[1]] - a[c[1]];
return 180 * Math.atan2(e, d) / Math.PI;
}
function J(a, b) {
return I(b[1], b[0], Ra) + I(a[1], a[0], Ra);
}
function K(a, b) {
return H(b[0], b[1], Ra) / H(a[0], a[1], Ra);
}
function L() {
this.evEl = Ta, this.evWin = Ua, this.pressed = !1, x.apply(this, arguments);
}
function M() {
this.evEl = Xa, this.evWin = Ya, x.apply(this, arguments), this.store = this.manager.session.pointerEvents = [];
}
function N() {
this.evTarget = $a, this.evWin = _a, this.started = !1, x.apply(this, arguments);
}
function O(a, b) {
var c = s(a.touches), d = s(a.changedTouches);
return b & (Ga | Ha) && (c = t(c.concat(d), 'identifier', !0)), [
c,
d
];
}
function P() {
this.evTarget = bb, this.targetIds = {}, x.apply(this, arguments);
}
function Q(a, b) {
var c = s(a.touches), d = this.targetIds;
if (b & (Ea | Fa) && 1 === c.length)
return d[c[0].identifier] = !0, [
c,
c
];
var e, f, g = s(a.changedTouches), h = [], i = this.target;
if (f = c.filter(function (a) {
return o(a.target, i);
}), b === Ea)
for (e = 0; e < f.length;)
d[f[e].identifier] = !0, e++;
for (e = 0; e < g.length;)
d[g[e].identifier] && h.push(g[e]), b & (Ga | Ha) && delete d[g[e].identifier], e++;
return h.length ? [
t(f.concat(h), 'identifier', !0),
h
] : void 0;
}
function R() {
x.apply(this, arguments);
var a = j(this.handler, this);
this.touch = new P(this.manager, a), this.mouse = new L(this.manager, a), this.primaryTouch = null, this.lastTouches = [];
}
function S(a, b) {
a & Ea ? (this.primaryTouch = b.changedPointers[0].identifier, T.call(this, b)) : a & (Ga | Ha) && T.call(this, b);
}
function T(a) {
var b = a.changedPointers[0];
if (b.identifier === this.primaryTouch) {
var c = {
x: b.clientX,
y: b.clientY
};
this.lastTouches.push(c);
var d = this.lastTouches, e = function () {
var a = d.indexOf(c);
a > -1 && d.splice(a, 1);
};
setTimeout(e, cb);
}
}
function U(a) {
for (var b = a.srcEvent.clientX, c = a.srcEvent.clientY, d = 0; d < this.lastTouches.length; d++) {
var e = this.lastTouches[d], f = Math.abs(b - e.x), g = Math.abs(c - e.y);
if (db >= f && db >= g)
return !0;
}
return !1;
}
function V(a, b) {
this.manager = a, this.set(b);
}
function W(a) {
if (p(a, jb))
return jb;
var b = p(a, kb), c = p(a, lb);
return b && c ? jb : b || c ? b ? kb : lb : p(a, ib) ? ib : hb;
}
function X() {
if (!fb)
return !1;
var b = {}, c = a.CSS && a.CSS.supports;
return [
'auto',
'manipulation',
'pan-y',
'pan-x',
'pan-x pan-y',
'none'
].forEach(function (d) {
b[d] = c ? a.CSS.supports('touch-action', d) : !0;
}), b;
}
function Y(a) {
this.options = la({}, this.defaults, a || {}), this.id = v(), this.manager = null, this.options.enable = l(this.options.enable, !0), this.state = nb, this.simultaneous = {}, this.requireFail = [];
}
function Z(a) {
return a & sb ? 'cancel' : a & qb ? 'end' : a & pb ? 'move' : a & ob ? 'start' : '';
}
function $(a) {
return a == Ma ? 'down' : a == La ? 'up' : a == Ja ? 'left' : a == Ka ? 'right' : '';
}
function _(a, b) {
var c = b.manager;
return c ? c.get(a) : a;
}
function aa() {
Y.apply(this, arguments);
}
function ba() {
aa.apply(this, arguments), this.pX = null, this.pY = null;
}
function ca() {
aa.apply(this, arguments);
}
function da() {
Y.apply(this, arguments), this._timer = null, this._input = null;
}
function ea() {
aa.apply(this, arguments);
}
function fa() {
aa.apply(this, arguments);
}
function ga() {
Y.apply(this, arguments), this.pTime = !1, this.pCenter = !1, this._timer = null, this._input = null, this.count = 0;
}
function ha(a, b) {
return b = b || {}, b.recognizers = l(b.recognizers, ha.defaults.preset), new ia(a, b);
}
function ia(a, b) {
this.options = la({}, ha.defaults, b || {}), this.options.inputTarget = this.options.inputTarget || a, this.handlers = {}, this.session = {}, this.recognizers = [], this.oldCssProps = {}, this.element = a, this.input = y(this), this.touchAction = new V(this, this.options.touchAction), ja(this, !0), g(this.options.recognizers, function (a) {
var b = this.add(new a[0](a[1]));
a[2] && b.recognizeWith(a[2]), a[3] && b.requireFailure(a[3]);
}, this);
}
function ja(a, b) {
var c = a.element;
if (c.style) {
var d;
g(a.options.cssProps, function (e, f) {
d = u(c.style, f), b ? (a.oldCssProps[d] = c.style[d], c.style[d] = e) : c.style[d] = a.oldCssProps[d] || '';
}), b || (a.oldCssProps = {});
}
}
function ka(a, c) {
var d = b.createEvent('Event');
d.initEvent(a, !0, !0), d.gesture = c, c.target.dispatchEvent(d);
}
var la, ma = [
'',
'webkit',
'Moz',
'MS',
'ms',
'o'
], na = b.createElement('div'), oa = 'function', pa = Math.round, qa = Math.abs, ra = Date.now;
la = 'function' != typeof Object.assign ? function (a) {
if (a === d || null === a)
throw new TypeError('Cannot convert undefined or null to object');
for (var b = Object(a), c = 1; c < arguments.length; c++) {
var e = arguments[c];
if (e !== d && null !== e)
for (var f in e)
e.hasOwnProperty(f) && (b[f] = e[f]);
}
return b;
} : Object.assign;
var sa = h(function (a, b, c) {
for (var e = Object.keys(b), f = 0; f < e.length;)
(!c || c && a[e[f]] === d) && (a[e[f]] = b[e[f]]), f++;
return a;
}, 'extend', 'Use `assign`.'), ta = h(function (a, b) {
return sa(a, b, !0);
}, 'merge', 'Use `assign`.'), ua = 1, va = /mobile|tablet|ip(ad|hone|od)|android/i, wa = 'ontouchstart' in a, xa = u(a, 'PointerEvent') !== d, ya = wa && va.test(navigator.userAgent), za = 'touch', Aa = 'pen', Ba = 'mouse', Ca = 'kinect', Da = 25, Ea = 1, Fa = 2, Ga = 4, Ha = 8, Ia = 1, Ja = 2, Ka = 4, La = 8, Ma = 16, Na = Ja | Ka, Oa = La | Ma, Pa = Na | Oa, Qa = [
'x',
'y'
], Ra = [
'clientX',
'clientY'
];
x.prototype = {
handler: function () {
},
init: function () {
this.evEl && m(this.element, this.evEl, this.domHandler), this.evTarget && m(this.target, this.evTarget, this.domHandler), this.evWin && m(w(this.element), this.evWin, this.domHandler);
},
destroy: function () {
this.evEl && n(this.element, this.evEl, this.domHandler), this.evTarget && n(this.target, this.evTarget, this.domHandler), this.evWin && n(w(this.element), this.evWin, this.domHandler);
}
};
var Sa = {
mousedown: Ea,
mousemove: Fa,
mouseup: Ga
}, Ta = 'mousedown', Ua = 'mousemove mouseup';
i(L, x, {
handler: function (a) {
var b = Sa[a.type];
b & Ea && 0 === a.button && (this.pressed = !0), b & Fa && 1 !== a.which && (b = Ga), this.pressed && (b & Ga && (this.pressed = !1), this.callback(this.manager, b, {
pointers: [a],
changedPointers: [a],
pointerType: Ba,
srcEvent: a
}));
}
});
var Va = {
pointerdown: Ea,
pointermove: Fa,
pointerup: Ga,
pointercancel: Ha,
pointerout: Ha
}, Wa = {
2: za,
3: Aa,
4: Ba,
5: Ca
}, Xa = 'pointerdown', Ya = 'pointermove pointerup pointercancel';
a.MSPointerEvent && !a.PointerEvent && (Xa = 'MSPointerDown', Ya = 'MSPointerMove MSPointerUp MSPointerCancel'), i(M, x, {
handler: function (a) {
var b = this.store, c = !1, d = a.type.toLowerCase().replace('ms', ''), e = Va[d], f = Wa[a.pointerType] || a.pointerType, g = f == za, h = r(b, a.pointerId, 'pointerId');
e & Ea && (0 === a.button || g) ? 0 > h && (b.push(a), h = b.length - 1) : e & (Ga | Ha) && (c = !0), 0 > h || (b[h] = a, this.callback(this.manager, e, {
pointers: b,
changedPointers: [a],
pointerType: f,
srcEvent: a
}), c && b.splice(h, 1));
}
});
var Za = {
touchstart: Ea,
touchmove: Fa,
touchend: Ga,
touchcancel: Ha
}, $a = 'touchstart', _a = 'touchstart touchmove touchend touchcancel';
i(N, x, {
handler: function (a) {
var b = Za[a.type];
if (b === Ea && (this.started = !0), this.started) {
var c = O.call(this, a, b);
b & (Ga | Ha) && c[0].length - c[1].length === 0 && (this.started = !1), this.callback(this.manager, b, {
pointers: c[0],
changedPointers: c[1],
pointerType: za,
srcEvent: a
});
}
}
});
var ab = {
touchstart: Ea,
touchmove: Fa,
touchend: Ga,
touchcancel: Ha
}, bb = 'touchstart touchmove touchend touchcancel';
i(P, x, {
handler: function (a) {
var b = ab[a.type], c = Q.call(this, a, b);
c && this.callback(this.manager, b, {
pointers: c[0],
changedPointers: c[1],
pointerType: za,
srcEvent: a
});
}
});
var cb = 2500, db = 25;
i(R, x, {
handler: function (a, b, c) {
var d = c.pointerType == za, e = c.pointerType == Ba;
if (!(e && c.sourceCapabilities && c.sourceCapabilities.firesTouchEvents)) {
if (d)
S.call(this, b, c);
else if (e && U.call(this, c))
return;
this.callback(a, b, c);
}
},
destroy: function () {
this.touch.destroy(), this.mouse.destroy();
}
});
var eb = u(na.style, 'touchAction'), fb = eb !== d, gb = 'compute', hb = 'auto', ib = 'manipulation', jb = 'none', kb = 'pan-x', lb = 'pan-y', mb = X();
V.prototype = {
set: function (a) {
a == gb && (a = this.compute()), fb && this.manager.element.style && mb[a] && (this.manager.element.style[eb] = a), this.actions = a.toLowerCase().trim();
},
update: function () {
this.set(this.manager.options.touchAction);
},
compute: function () {
var a = [];
return g(this.manager.recognizers, function (b) {
k(b.options.enable, [b]) && (a = a.concat(b.getTouchAction()));
}), W(a.join(' '));
},
preventDefaults: function (a) {
var b = a.srcEvent, c = a.offsetDirection;
if (this.manager.session.prevented)
return void b.preventDefault();
var d = this.actions, e = p(d, jb) && !mb[jb], f = p(d, lb) && !mb[lb], g = p(d, kb) && !mb[kb];
if (e) {
var h = 1 === a.pointers.length, i = a.distance < 2, j = a.deltaTime < 250;
if (h && i && j)
return;
}
return g && f ? void 0 : e || f && c & Na || g && c & Oa ? this.preventSrc(b) : void 0;
},
preventSrc: function (a) {
this.manager.session.prevented = !0, a.preventDefault();
}
};
var nb = 1, ob = 2, pb = 4, qb = 8, rb = qb, sb = 16, tb = 32;
Y.prototype = {
defaults: {},
set: function (a) {
return la(this.options, a), this.manager && this.manager.touchAction.update(), this;
},
recognizeWith: function (a) {
if (f(a, 'recognizeWith', this))
return this;
var b = this.simultaneous;
return a = _(a, this), b[a.id] || (b[a.id] = a, a.recognizeWith(this)), this;
},
dropRecognizeWith: function (a) {
return f(a, 'dropRecognizeWith', this) ? this : (a = _(a, this), delete this.simultaneous[a.id], this);
},
requireFailure: function (a) {
if (f(a, 'requireFailure', this))
return this;
var b = this.requireFail;
return a = _(a, this), -1 === r(b, a) && (b.push(a), a.requireFailure(this)), this;
},
dropRequireFailure: function (a) {
if (f(a, 'dropRequireFailure', this))
return this;
a = _(a, this);
var b = r(this.requireFail, a);
return b > -1 && this.requireFail.splice(b, 1), this;
},
hasRequireFailures: function () {
return this.requireFail.length > 0;
},
canRecognizeWith: function (a) {
return !!this.simultaneous[a.id];
},
emit: function (a) {
function b(b) {
c.manager.emit(b, a);
}
var c = this, d = this.state;
qb > d && b(c.options.event + Z(d)), b(c.options.event), a.additionalEvent && b(a.additionalEvent), d >= qb && b(c.options.event + Z(d));
},
tryEmit: function (a) {
return this.canEmit() ? this.emit(a) : void (this.state = tb);
},
canEmit: function () {
for (var a = 0; a < this.requireFail.length;) {
if (!(this.requireFail[a].state & (tb | nb)))
return !1;
a++;
}
return !0;
},
recognize: function (a) {
var b = la({}, a);
return k(this.options.enable, [
this,
b
]) ? (this.state & (rb | sb | tb) && (this.state = nb), this.state = this.process(b), void (this.state & (ob | pb | qb | sb) && this.tryEmit(b))) : (this.reset(), void (this.state = tb));
},
process: function (a) {
},
getTouchAction: function () {
},
reset: function () {
}
}, i(aa, Y, {
defaults: { pointers: 1 },
attrTest: function (a) {
var b = this.options.pointers;
return 0 === b || a.pointers.length === b;
},
process: function (a) {
var b = this.state, c = a.eventType, d = b & (ob | pb), e = this.attrTest(a);
return d && (c & Ha || !e) ? b | sb : d || e ? c & Ga ? b | qb : b & ob ? b | pb : ob : tb;
}
}), i(ba, aa, {
defaults: {
event: 'pan',
threshold: 10,
pointers: 1,
direction: Pa
},
getTouchAction: function () {
var a = this.options.direction, b = [];
return a & Na && b.push(lb), a & Oa && b.push(kb), b;
},
directionTest: function (a) {
var b = this.options, c = !0, d = a.distance, e = a.direction, f = a.deltaX, g = a.deltaY;
return e & b.direction || (b.direction & Na ? (e = 0 === f ? Ia : 0 > f ? Ja : Ka, c = f != this.pX, d = Math.abs(a.deltaX)) : (e = 0 === g ? Ia : 0 > g ? La : Ma, c = g != this.pY, d = Math.abs(a.deltaY))), a.direction = e, c && d > b.threshold && e & b.direction;
},
attrTest: function (a) {
return aa.prototype.attrTest.call(this, a) && (this.state & ob || !(this.state & ob) && this.directionTest(a));
},
emit: function (a) {
this.pX = a.deltaX, this.pY = a.deltaY;
var b = $(a.direction);
b && (a.additionalEvent = this.options.event + b), this._super.emit.call(this, a);
}
}), i(ca, aa, {
defaults: {
event: 'pinch',
threshold: 0,
pointers: 2
},
getTouchAction: function () {
return [jb];
},
attrTest: function (a) {
return this._super.attrTest.call(this, a) && (Math.abs(a.scale - 1) > this.options.threshold || this.state & ob);
},
emit: function (a) {
if (1 !== a.scale) {
var b = a.scale < 1 ? 'in' : 'out';
a.additionalEvent = this.options.event + b;
}
this._super.emit.call(this, a);
}
}), i(da, Y, {
defaults: {
event: 'press',
pointers: 1,
time: 251,
threshold: 9
},
getTouchAction: function () {
return [hb];
},
process: function (a) {
var b = this.options, c = a.pointers.length === b.pointers, d = a.distance < b.threshold, f = a.deltaTime > b.time;
if (this._input = a, !d || !c || a.eventType & (Ga | Ha) && !f)
this.reset();
else if (a.eventType & Ea)
this.reset(), this._timer = e(function () {
this.state = rb, this.tryEmit();
}, b.time, this);
else if (a.eventType & Ga)
return rb;
return tb;
},
reset: function () {
clearTimeout(this._timer);
},
emit: function (a) {
this.state === rb && (a && a.eventType & Ga ? this.manager.emit(this.options.event + 'up', a) : (this._input.timeStamp = ra(), this.manager.emit(this.options.event, this._input)));
}
}), i(ea, aa, {
defaults: {
event: 'rotate',
threshold: 0,
pointers: 2
},
getTouchAction: function () {
return [jb];
},
attrTest: function (a) {
return this._super.attrTest.call(this, a) && (Math.abs(a.rotation) > this.options.threshold || this.state & ob);
}
}), i(fa, aa, {
defaults: {
event: 'swipe',
threshold: 10,
velocity: 0.3,
direction: Na | Oa,
pointers: 1
},
getTouchAction: function () {
return ba.prototype.getTouchAction.call(this);
},
attrTest: function (a) {
var b, c = this.options.direction;
return c & (Na | Oa) ? b = a.overallVelocity : c & Na ? b = a.overallVelocityX : c & Oa && (b = a.overallVelocityY), this._super.attrTest.call(this, a) && c & a.offsetDirection && a.distance > this.options.threshold && a.maxPointers == this.options.pointers && qa(b) > this.options.velocity && a.eventType & Ga;
},
emit: function (a) {
var b = $(a.offsetDirection);
b && this.manager.emit(this.options.event + b, a), this.manager.emit(this.options.event, a);
}
}), i(ga, Y, {
defaults: {
event: 'tap',
pointers: 1,
taps: 1,
interval: 300,
time: 250,
threshold: 9,
posThreshold: 10
},
getTouchAction: function () {
return [ib];
},
process: function (a) {
var b = this.options, c = a.pointers.length === b.pointers, d = a.distance < b.threshold, f = a.deltaTime < b.time;
if (this.reset(), a.eventType & Ea && 0 === this.count)
return this.failTimeout();
if (d && f && c) {
if (a.eventType != Ga)
return this.failTimeout();
var g = this.pTime ? a.timeStamp - this.pTime < b.interval : !0, h = !this.pCenter || H(this.pCenter, a.center) < b.posThreshold;
this.pTime = a.timeStamp, this.pCenter = a.center, h && g ? this.count += 1 : this.count = 1, this._input = a;
var i = this.count % b.taps;
if (0 === i)
return this.hasRequireFailures() ? (this._timer = e(function () {
this.state = rb, this.tryEmit();
}, b.interval, this), ob) : rb;
}
return tb;
},
failTimeout: function () {
return this._timer = e(function () {
this.state = tb;
}, this.options.interval, this), tb;
},
reset: function () {
clearTimeout(this._timer);
},
emit: function () {
this.state == rb && (this._input.tapCount = this.count, this.manager.emit(this.options.event, this._input));
}
}), ha.VERSION = '2.0.7', ha.defaults = {
domEvents: !1,
touchAction: gb,
enable: !0,
inputTarget: null,
inputClass: null,
preset: [
[
ea,
{ enable: !1 }
],
[
ca,
{ enable: !1 },
['rotate']
],
[
fa,
{ direction: Na }
],
[
ba,
{ direction: Na },
['swipe']
],
[ga],
[
ga,
{
event: 'doubletap',
taps: 2
},
['tap']
],
[da]
],
cssProps: {
userSelect: 'none',
touchSelect: 'none',
touchCallout: 'none',
contentZooming: 'none',
userDrag: 'none',
tapHighlightColor: 'rgba(0,0,0,0)'
}
};
var ub = 1, vb = 2;
ia.prototype = {
set: function (a) {
return la(this.options, a), a.touchAction && this.touchAction.update(), a.inputTarget && (this.input.destroy(), this.input.target = a.inputTarget, this.input.init()), this;
},
stop: function (a) {
this.session.stopped = a ? vb : ub;
},
recognize: function (a) {
var b = this.session;
if (!b.stopped) {
this.touchAction.preventDefaults(a);
var c, d = this.recognizers, e = b.curRecognizer;
(!e || e && e.state & rb) && (e = b.curRecognizer = null);
for (var f = 0; f < d.length;)
c = d[f], b.stopped === vb || e && c != e && !c.canRecognizeWith(e) ? c.reset() : c.recognize(a), !e && c.state & (ob | pb | qb) && (e = b.curRecognizer = c), f++;
}
},
get: function (a) {
if (a instanceof Y)
return a;
for (var b = this.recognizers, c = 0; c < b.length; c++)
if (b[c].options.event == a)
return b[c];
return null;
},
add: function (a) {
if (f(a, 'add', this))
return this;
var b = this.get(a.options.event);
return b && this.remove(b), this.recognizers.push(a), a.manager = this, this.touchAction.update(), a;
},
remove: function (a) {
if (f(a, 'remove', this))
return this;
if (a = this.get(a)) {
var b = this.recognizers, c = r(b, a);
-1 !== c && (b.splice(c, 1), this.touchAction.update());
}
return this;
},
on: function (a, b) {
if (a !== d && b !== d) {
var c = this.handlers;
return g(q(a), function (a) {
c[a] = c[a] || [], c[a].push(b);
}), this;
}
},
off: function (a, b) {
if (a !== d) {
var c = this.handlers;
return g(q(a), function (a) {
b ? c[a] && c[a].splice(r(c[a], b), 1) : delete c[a];
}), this;
}
},
emit: function (a, b) {
this.options.domEvents && ka(a, b);
var c = this.handlers[a] && this.handlers[a].slice();
if (c && c.length) {
b.type = a, b.preventDefault = function () {
b.srcEvent.preventDefault();
};
for (var d = 0; d < c.length;)
c[d](b), d++;
}
},
destroy: function () {
this.element && ja(this, !1), this.handlers = {}, this.session = {}, this.input.destroy(), this.element = null;
}
}, la(ha, {
INPUT_START: Ea,
INPUT_MOVE: Fa,
INPUT_END: Ga,
INPUT_CANCEL: Ha,
STATE_POSSIBLE: nb,
STATE_BEGAN: ob,
STATE_CHANGED: pb,
STATE_ENDED: qb,
STATE_RECOGNIZED: rb,
STATE_CANCELLED: sb,
STATE_FAILED: tb,
DIRECTION_NONE: Ia,
DIRECTION_LEFT: Ja,
DIRECTION_RIGHT: Ka,
DIRECTION_UP: La,
DIRECTION_DOWN: Ma,
DIRECTION_HORIZONTAL: Na,
DIRECTION_VERTICAL: Oa,
DIRECTION_ALL: Pa,
Manager: ia,
Input: x,
TouchAction: V,
TouchInput: P,
MouseInput: L,
PointerEventInput: M,
TouchMouseInput: R,
SingleTouchInput: N,
Recognizer: Y,
AttrRecognizer: aa,
Tap: ga,
Pan: ba,
Swipe: fa,
Pinch: ca,
Rotate: ea,
Press: da,
on: m,
off: n,
each: g,
merge: ta,
extend: sa,
assign: la,
inherit: i,
bindFn: j,
prefixed: u
});
var wb = 'undefined' != typeof a ? a : 'undefined' != typeof self ? self : {};
wb.Hammer = ha, 'function' == typeof define && define.amd ? define(function () {
return ha;
}) : 'undefined' != typeof module && module.exports ? module.exports = ha : a[c] = ha;
}(window, document, 'Hammer');
var defaults = {
contentEl: 'content',
ptrEl: 'ptr'
};
var options = {};
var pan = {
enabled: false,
distance: 0,
startingPositionY: 0
};
var pxTableViewPullToRefreshBehavior = {
properties: {
pullToRefresh: {
type: Boolean,
value: false
},
distanceToRefresh: {
type: Number,
value: 70
},
loadingFunction: { type: String },
resistance: {
type: Number,
value: 2.5
},
transition: {
type: String,
value: 'all .25s'
}
},
_hammer: null,
attached: function () {
if (this.pullToRefresh) {
this.async(function () {
this.toggleClass('table-view--ptr', this.pullToRefresh, this.$.content);
this.toggleClass('ptr', this.pullToRefresh);
this.toggleClass('ptr__content', this.pullToRefresh, this.$.content);
this._init();
});
}
},
detached: function () {
if (this.pullToRefresh) {
if (this._hammer) {
this._hammer.off();
}
}
},
_init: function (params) {
params = params || {};
options = {
contentEl: this.$.content,
ptrEl: this.$.ptr,
distanceToRefresh: this.distanceToRefresh,
loadingFunction: this.loadingFunction,
resistance: this.resistance,
touchAction: 'manipulation'
};
if (!options.contentEl || !options.ptrEl) {
console.error('No contentEl or ptrEl', options);
return false;
}
this._hammer = new Hammer.Manager(options.contentEl, options);
this._hammer.add(new Hammer.Pan({ direction: Hammer.DIRECTION_VERTICAL }));
this._hammer.on('panstart panup pandown panend', Hammer.bindFn(this._onPan, this));
},
_onPan: function (event) {
switch (event.type) {
case 'panstart':
this._onPanStart(event);
break;
case 'pandown':
this._onPanDown(event);
break;
case 'panup':
this._onPanUp(event);
break;
case 'panend':
this._onPanEnd(event);
break;
}
},
_setBodyClass: function () {
if (pan.distance > options.distanceToRefresh) {
this.toggleClass('ptr-refresh', true);
} else {
this.toggleClass('ptr-refresh', false);
}
},
_onPanStart: function (e) {
pan.startingPositionY = document.body.scrollTop;
if (pan.startingPositionY === 0) {
pan.enabled = true;
}
},
_onPanDown: function (e) {
if (!pan.enabled) {
return;
}
e.preventDefault();
pan.distance = e.distance / options.resistance;
this._setContentPan();
this._setBodyClass();
},
_onPanUp: function (e) {
if (!pan.enabled || pan.distance === 0) {
return;
}
e.preventDefault();
if (pan.distance < e.distance / options.resistance) {
pan.distance = 0;
} else {
pan.distance = e.distance / options.resistance;
}
this._setContentPan();
this._setBodyClass();
},
_onPanEnd: function (e) {
if (!pan.enabled) {
return;
}
e.preventDefault();
options.contentEl.style.transform = options.contentEl.style.webkitTransform = '';
options.ptrEl.style.transform = options.ptrEl.style.webkitTransform = '';
if (this.classList.contains('ptr-refresh')) {
this._doLoading();
} else {
this._doReset();
}
pan.distance = 0;
pan.enabled = false;
},
_setContentPan: function (e) {
this.transform(this._transformForTranslateY(pan.distance), options.contentEl);
this.transform(this._transformForTranslateY(pan.distance - options.ptrEl.offsetHeight), options.ptrEl);
},
_doLoading: function (e) {
var self = this;
this.toggleClass('ptr-loading', true);
this.toggleClass('ptr-reset', false);
this.fire('px-table-row-ptr-loading');
if (!this.loadingFunction) {
return this._doReset();
}
console.warn('dispatch event, add hide prop and remove time');
var loadingPromise = this.loadingFunction();
setTimeout(function () {
loadingPromise.then(self._doReset.bind(self));
}, 1000);
},
_doReset: function (e) {
this.style.touchActioxn = 'unset';
this.toggleClass('ptr-loading', false);
this.toggleClass('ptr-refresh', false);
this.toggleClass('ptr-reset', true);
this.addEventListener('transitionend', this._onTransitionEnd, false);
this.fire('px-table-row-ptr-reset');
},
_onTransitionEnd: function () {
this.toggleClass('ptr-reset', false);
this.removeEventListener('transitionend', this._onTransitionEnd, false);
console.log('Did fire');
},
_transformForTranslateY: function (translateY) {
if (translateY === null) {
return 'translate3d(0, 0, 0)';
}
return 'translate3d(0, ' + translateY + 'px, 0)';
}
};
var pxTableRowBehavior = {
attached: function () {
var _this = this;
this.async(function () {
_this._init();
});
},
_init: function () {
var _this = this;
if (_this.size) {
_this.toggleClass('table-row--' + _this.size, true, _this.$$('.table-row'));
}
if (_this.collapsable) {
_this.toggleClass('table-row--collapsable', true, _this.$$('.table-row'));
}
if (_this.iconPos) {
_this.toggleClass('table-row__media--' + _this.iconPos, true, _this.$$('.table-row__media--icon'));
}
if (_this.imagePos) {
_this.toggleClass('table-row__media--' + _this.imagePos, true, _this.$$('.table-row__media--image'));
}
if (_this.mediaPos) {
_this.toggleClass('table-row__media--' + _this.mediaPos, true, _this.$$('.table-row__media'));
if (_this.mediaPos === 'right') {
_this.toggleClass('u-mr++', true, _this.$$('.table-row__media'));
}
}
if (_this.item) {
var item = _this.item;
for (var prop in item) {
_this[prop] = item[prop];
}
}
},
_handleRemoveItem: function (e) {
e.preventDefault();
this.fire('remove', e);
this.remove();
return false;
},
_handleReorderItem: function (e) {
e.preventDefault();
this.fire('reorder', e);
return false;
},
_handleModifier: function (newVal, oldVal) {
var _this = this, klass, types;
klass = 'table-row--' + oldVal;
_this.toggleClass(klass, false, _this.$$('.table-row'));
if (_this.modifier) {
types = _this.modifier.split(' ');
for (var i = 0; i < types.length; i++) {
klass = 'table-row--' + types[i];
_this.toggleClass(klass, true, _this.$$('.table-row'));
}
}
}
};
Polymer({
is: 'px-table-row-checkbox',
properties: {
label: { type: String },
name: { type: String },
value: { type: String },
type: { type: String },
checked: { type: Boolean },
disabled: { type: Boolean }
},
attached: function () {
if (this.type) {
this.toggleClass('table-row__checkbox--' + this.type, true, this.$$('label'));
}
if (this.checked) {
this.$$('input').checked = true;
}
if (this.disabled) {
this.$$('input').disabled = true;
}
this.listen(this.$$('label'), 'tap', 'handleTap');
},
handleTap: function (e) {
if (this.disabled) {
return;
}
var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (iOS) {
}
}
});
Polymer({
is: 'px-table-row-actions',
properties: {
position: {
type: String,
value: 'right'
},
opened: { type: Boolean }
},
getWidth: function () {
return this.$.content.offsetWidth;
},
attached: function () {
var self = this;
this.async(function () {
self.toggleClass('table-row__actions--' + this.position, true, self.$$('.table-row__actions'));
var _content = Polymer.dom(this.$.content).getDistributedNodes()[0];
this.style.width = _content.offsetWidth + 'px';
this.style.height = _content.offsetHeight + 'px';
}, 500);
},
toggle: function () {
this.opened = !this.opened;
this.toggleClass('is-visible', this.opened, this.$$('.table-row__actions'));
}
});
Polymer({
is: 'px-table-row-action-button',
properties: {
label: { type: String },
icon: { type: String },
type: { type: String }
},
attached: function () {
var self = this;
this.async(function () {
self.toggleClass('flex', true);
self.toggleClass('table-row__button--' + this.type, true, this.$$('.table-row__button'));
});
},
_handleTap: function (e) {
this.fire('tap', e);
}
});
var sharedPanel = null;
if (!window.Hammer) {
console.error('Must provide hammer.js');
}
var reqAnimationFrame = function () {
return window[Hammer.prefixed(window, 'requestAnimationFrame')] || function (callback) {
setTimeout(callback, 1000 / 60);
};
}();
function dirProp(direction, hProp, vProp) {
return direction & Hammer.DIRECTION_HORIZONTAL ? hProp : vProp;
}
var pxTableRowSwipeBehavior = {
properties: {
tapReset: {
type: Boolean,
value: true
},
disableSwipe: {
type: Boolean,
value: false
},
swipeLeft: {
type: Boolean,
value: false
},
swipeRight: {
type: Boolean,
value: false
},
fitUnderlay: {
type: Boolean,
value: false
},
peekOffset: {
type: Number,
value: 30
},
slideOffset: {
type: Number,
value: 80
},
threshold: {
type: Number,
value: 2
},
underlayOpened: {
type: Boolean,
value: false
},
_dragging: {
type: Boolean,
value: false
},
_transition: {
type: Boolean,
value: false
},
_slideLeft: { type: Boolean },
_transitionDelta: {
type: Number,
observer: '_transitionDeltaChanged'
},
_validDelta: {
type: Boolean,
value: false
},
_atEdge: {
type: Boolean,
value: false
},
_curPos: { type: Number },
_tracking: {
type: Boolean,
value: false
},
_content: Object,
_underlay: Object,
hammer: Object
},
listeners: {
'tap': '_tapHandler',
'iron-resize': '_onIronResize'
},
ready: function () {
if (this.swipeable) {
this._transition = true;
this.setScrollDirection(this._swipeAllowed() ? 'y' : 'all');
this.toggleClass('table-row--swipeable', true, this.$.row);
}
},
attached: function () {
if (this.swipeable) {
var _content = Polymer.dom(this);
this.async(function () {
this._initSwipeActions(this, Hammer.DIRECTION_HORIZONTAL);
}, 1000);
this.set('_content', _content);
}
},
_initSwipeActions: function (container, direction) {
var instance = container;
this.container = container;
this.direction = direction;
var _underlay = Polymer.dom(this.$.underlayContent).getDistributedNodes()[0];
this.set('_underlay', _underlay);
var distributed = this.getContentChildren('#underlayContent');
this.underlay = distributed[0];
if (this.underlay) {
this.underlaySize = this.underlay.getBoundingClientRect().width;
}
this.containerSize = this.container[dirProp(direction, 'offsetWidth', 'offsetHeight')];
var options = {
direction: this.direction,
threshold: this.threshold,
touchAction: 'manipulation'
};
this.hammer = new Hammer.Manager(this.container, options);
this.hammer.add(new Hammer.Pan(options));
this.hammer.on('panstart panmove panend', Hammer.bindFn(this._onPan, this));
},
detached: function () {
if (this.hammer) {
this.hammer.off();
}
},
_tapHandler: function (event) {
if (this.tapReset) {
if (this._atEdge) {
this.resetPosition();
}
}
if (sharedPanel) {
sharedPanel = null;
}
},
_swipeAllowed: function () {
return !this.disableSwipe;
},
_transitionDeltaChanged: function (newValue, oldValue) {
if (this.swipeRight) {
this._validDelta = this._atEdge ? newValue <= -this.slideOffset : newValue >= this.slideOffset;
}
if (this.swipeLeft) {
this._validDelta = this._atEdge ? newValue >= this.slideOffset : newValue <= -this.slideOffset;
}
if (!this.swipeLeft && !this.swipeRight) {
if (newValue > oldValue) {
this._slideLeft = false;
this._validDelta = newValue >= this.slideOffset;
}
if (newValue < oldValue) {
this._slideLeft = true;
this._validDelta = newValue <= -this.slideOffset;
}
}
},
_onPan: function (event) {
switch (event.type) {
case 'panstart':
this._onPanStart(event);
break;
case 'panmove':
this._onPanMove(event);
break;
case 'panend':
this._onPanEnd(event);
break;
}
},
resetPosition: function () {
this._moveDrawer(null);
this.set('underlayOpened', false);
this.set('_atEdge', false);
this.set('_curPos', 0);
this.fire('px-table-row-swipe-reset', this);
this.toggleClass('is-open', this._atEdge, this.$.row);
},
_onPanStart: function (event) {
if (this._swipeAllowed()) {
sharedPanel = this;
this._dragging = true;
if (this._dragging) {
this.width = this._content.offsetWidth;
this._transition = false;
}
this.fire('px-table-row-swipe-start', event);
}
},
_onPanMove: function (event) {
this._transition = true;
if (this._dragging) {
var dx = event.deltaX;
var dragDx;
this._transitionDelta = dx;
dragDx = this._atEdge ? this._curPos + dx : dx;
this._tracking = true;
this._moveDrawer(dragDx);
}
},
_onPanEnd: function (event) {
this._dragging = false;
var slideTo, offsetLR, deltaLR;
if (this._swipeAllowed() && this._tracking) {
slideTo = this.containerSize - this.peekOffset;
if (this.fitUnderlay) {
slideTo = this.underlaySize;
}
offsetLR = this.swipeRight ? slideTo : -slideTo;
if (!this.swipeLeft) {
offsetLR = this._slideLeft ? -slideTo : slideTo;
}
deltaLR = this._validDelta && !this._atEdge ? offsetLR : null;
this._curPos = this._atEdge ? null : deltaLR;
this._atEdge = deltaLR !== null;
this._validDelta = false;
this._tracking = false;
this.set('underlayOpened', this._atEdge);
this.fire('px-table-row-swipe-end', this);
this._moveDrawer(deltaLR);
}
},
_onIronResize: function () {
var _content = this._content;
var w = this.offsetWidth;
var distributed = this.getContentChildren('#underlayContent');
this.underlay = distributed[0];
if (this.underlay) {
this.underlaySize = this.underlay.getBoundingClientRect().width;
}
if (_content && this._toUpdateHeight) {
this.async(function () {
}, 1);
}
},
_moveDrawer: function (translateX) {
var _content = this.$.row;
this.transform(this._transformForTranslateX(translateX), _content);
this.toggleClass('is-open', this.underlayOpened, _content);
this.toggleClass('transition', this._transition, _content);
this.toggleClass('dragging', this._dragging, _content);
this.toggleClass('swipe-left', this.swipeLeft, _content);
this.toggleClass('swipe-right', this.swipeRight, _content);
},
_transformForTranslateX: function (translateX) {
if (translateX === null) {
return 'translate3d(0, 0, 0)';
}
return 'translate3d(' + translateX + 'px, 0, 0)';
}
};
Polymer({
is: 'px-table-row-switch',
properties: {
size: { type: String },
label: { type: String },
name: { type: String },
value: { type: String },
checked: { type: Boolean },
disabled: { type: Boolean }
},
attached: function () {
if (this.checked) {
this.$$('input').checked = true;
}
if (this.disabled) {
this.$$('input').disabled = true;
}
if (this.size) {
this.toggleClass('toggle__input--' + this.size, true, this.$$('input'));
this.toggleClass('toggle__label--' + this.size, true, this.$$('label'));
}
this.listen(this.$$('label'), 'tap', 'handleTap');
},
handleTap: function (e) {
if (this.disabled) {
return;
}
var iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (iOS) {
}
}
});
!function (a, b, c, d) {
'use strict';
function e(a, b, c) {
return setTimeout(j(a, c), b);
}
function f(a, b, c) {
return Array.isArray(a) ? (g(a, c[b], c), !0) : !1;
}
function g(a, b, c) {
var e;
if (a)
if (a.forEach)
a.forEach(b, c);
else if (a.length !== d)
for (e = 0; e < a.length;)
b.call(c, a[e], e, a), e++;
else
for (e in a)
a.hasOwnProperty(e) && b.call(c, a[e], e, a);
}
function h(b, c, d) {
var e = 'DEPRECATED METHOD: ' + c + '\n' + d + ' AT \n';
return function () {
var c = new Error('get-stack-trace'), d = c && c.stack ? c.stack.replace(/^[^\(]+?[\n$]/gm, '').replace(/^\s+at\s+/gm, '').replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@') : 'Unknown Stack Trace', f = a.console && (a.console.warn || a.console.log);
return f && f.call(a.console, e, d), b.apply(this, arguments);
};
}
function i(a, b, c) {
var d, e = b.prototype;
d = a.prototype = Object.create(e), d.constructor = a, d._super = e, c && la(d, c);
}
function j(a, b) {
return function () {
return a.apply(b, arguments);
};
}
function k(a, b) {
return typeof a == oa ? a.apply(b ? b[0] || d : d, b) : a;
}
function l(a, b) {
return a === d ? b : a;
}
function m(a, b, c) {
g(q(b), function (b) {
a.addEventListener(b, c, !1);
});
}
function n(a, b, c) {
g(q(b), function (b) {
a.removeEventListener(b, c, !1);
});
}
function o(a, b) {
for (; a;) {
if (a == b)
return !0;
a = a.parentNode;
}
return !1;
}
function p(a, b) {
return a.indexOf(b) > -1;
}
function q(a) {
return a.trim().split(/\s+/g);
}
function r(a, b, c) {
if (a.indexOf && !c)
return a.indexOf(b);
for (var d = 0; d < a.length;) {
if (c && a[d][c] == b || !c && a[d] === b)
return d;
d++;
}
return -1;
}
function s(a) {
return Array.prototype.slice.call(a, 0);
}
function t(a, b, c) {
for (var d = [], e = [], f = 0; f < a.length;) {
var g = b ? a[f][b] : a[f];
r(e, g) < 0 && d.push(a[f]), e[f] = g, f++;
}
return c && (d = b ? d.sort(function (a, c) {
return a[b] > c[b];
}) : d.sort()), d;
}
function u(a, b) {
for (var c, e, f = b[0].toUpperCase() + b.slice(1), g = 0; g < ma.length;) {
if (c = ma[g], e = c ? c + f : b, e in a)
return e;
g++;
}
return d;
}
function v() {
return ua++;
}
function w(b) {
var c = b.ownerDocument || b;
return c.defaultView || c.parentWindow || a;
}
function x(a, b) {
var c = this;
this.manager = a, this.callback = b, this.element = a.element, this.target = a.options.inputTarget, this.domHandler = function (b) {
k(a.options.enable, [a]) && c.handler(b);
}, this.init();
}
function y(a) {
var b, c = a.options.inputClass;
return new (b = c ? c : xa ? M : ya ? P : wa ? R : L)(a, z);
}
function z(a, b, c) {
var d = c.pointers.length, e = c.changedPointers.length, f = b & Ea && d - e === 0, g = b & (Ga | Ha) && d - e === 0;
c.isFirst = !!f, c.isFinal = !!g, f && (a.session = {}), c.eventType = b, A(a, c), a.emit('hammer.input', c), a.recognize(c), a.session.prevInput = c;
}
function A(a, b) {
var c = a.session, d = b.pointers, e = d.length;
c.firstInput || (c.firstInput = D(b)), e > 1 && !c.firstMultiple ? c.firstMultiple = D(b) : 1 === e && (c.firstMultiple = !1);
var f = c.firstInput, g = c.firstMultiple, h = g ? g.center : f.center, i = b.center = E(d);
b.timeStamp = ra(), b.deltaTime = b.timeStamp - f.timeStamp, b.angle = I(h, i), b.distance = H(h, i), B(c, b), b.offsetDirection = G(b.deltaX, b.deltaY);
var j = F(b.deltaTime, b.deltaX, b.deltaY);
b.overallVelocityX = j.x, b.overallVelocityY = j.y, b.overallVelocity = qa(j.x) > qa(j.y) ? j.x : j.y, b.scale = g ? K(g.pointers, d) : 1, b.rotation = g ? J(g.pointers, d) : 0, b.maxPointers = c.prevInput ? b.pointers.length > c.prevInput.maxPointers ? b.pointers.length : c.prevInput.maxPointers : b.pointers.length, C(c, b);
var k = a.element;
o(b.srcEvent.target, k) && (k = b.srcEvent.target), b.target = k;
}
function B(a, b) {
var c = b.center, d = a.offsetDelta || {}, e = a.prevDelta || {}, f = a.prevInput || {};
b.eventType !== Ea && f.eventType !== Ga || (e = a.prevDelta = {
x: f.deltaX || 0,
y: f.deltaY || 0
}, d = a.offsetDelta = {
x: c.x,
y: c.y
}), b.deltaX = e.x + (c.x - d.x), b.deltaY = e.y + (c.y - d.y);
}
function C(a, b) {
var c, e, f, g, h = a.lastInterval || b, i = b.timeStamp - h.timeStamp;
if (b.eventType != Ha && (i > Da || h.velocity === d)) {
var j = b.deltaX - h.deltaX, k = b.deltaY - h.deltaY, l = F(i, j, k);
e = l.x, f = l.y, c = qa(l.x) > qa(l.y) ? l.x : l.y, g = G(j, k), a.lastInterval = b;
} else
c = h.velocity, e = h.velocityX, f = h.velocityY, g = h.direction;
b.velocity = c, b.velocityX = e, b.velocityY = f, b.direction = g;
}
function D(a) {
for (var b = [], c = 0; c < a.pointers.length;)
b[c] = {
clientX: pa(a.pointers[c].clientX),
clientY: pa(a.pointers[c].clientY)
}, c++;
return {
timeStamp: ra(),
pointers: b,
center: E(b),
deltaX: a.deltaX,
deltaY: a.deltaY
};
}
function E(a) {
var b = a.length;
if (1 === b)
return {
x: pa(a[0].clientX),
y: pa(a[0].clientY)
};
for (var c = 0, d = 0, e = 0; b > e;)
c += a[e].clientX, d += a[e].clientY, e++;
return {
x: pa(c / b),
y: pa(d / b)
};
}
function F(a, b, c) {
return {
x: b / a || 0,
y: c / a || 0
};
}
function G(a, b) {
return a === b ? Ia : qa(a) >= qa(b) ? 0 > a ? Ja : Ka : 0 > b ? La : Ma;
}
function H(a, b, c) {
c || (c = Qa);
var d = b[c[0]] - a[c[0]], e = b[c[1]] - a[c[1]];
return Math.sqrt(d * d + e * e);
}
function I(a, b, c) {
c || (c = Qa);
var d = b[c[0]] - a[c[0]], e = b[c[1]] - a[c[1]];
return 180 * Math.atan2(e, d) / Math.PI;
}
function J(a, b) {
return I(b[1], b[0], Ra) + I(a[1], a[0], Ra);
}
function K(a, b) {
return H(b[0], b[1], Ra) / H(a[0], a[1], Ra);
}
function L() {
this.evEl = Ta, this.evWin = Ua, this.pressed = !1, x.apply(this, arguments);
}
function M() {
this.evEl = Xa, this.evWin = Ya, x.apply(this, arguments), this.store = this.manager.session.pointerEvents = [];
}
function N() {
this.evTarget = $a, this.evWin = _a, this.started = !1, x.apply(this, arguments);
}
function O(a, b) {
var c = s(a.touches), d = s(a.changedTouches);
return b & (Ga | Ha) && (c = t(c.concat(d), 'identifier', !0)), [
c,
d
];
}
function P() {
this.evTarget = bb, this.targetIds = {}, x.apply(this, arguments);
}
function Q(a, b) {
var c = s(a.touches), d = this.targetIds;
if (b & (Ea | Fa) && 1 === c.length)
return d[c[0].identifier] = !0, [
c,
c
];
var e, f, g = s(a.changedTouches), h = [], i = this.target;
if (f = c.filter(function (a) {
return o(a.target, i);
}), b === Ea)
for (e = 0; e < f.length;)
d[f[e].identifier] = !0, e++;
for (e = 0; e < g.length;)
d[g[e].identifier] && h.push(g[e]), b & (Ga | Ha) && delete d[g[e].identifier], e++;
return h.length ? [
t(f.concat(h), 'identifier', !0),
h
] : void 0;
}
function R() {
x.apply(this, arguments);
var a = j(this.handler, this);
this.touch = new P(this.manager, a), this.mouse = new L(this.manager, a), this.primaryTouch = null, this.lastTouches = [];
}
function S(a, b) {
a & Ea ? (this.primaryTouch = b.changedPointers[0].identifier, T.call(this, b)) : a & (Ga | Ha) && T.call(this, b);
}
function T(a) {
var b = a.changedPointers[0];
if (b.identifier === this.primaryTouch) {
var c = {
x: b.clientX,
y: b.clientY
};
this.lastTouches.push(c);
var d = this.lastTouches, e = function () {
var a = d.indexOf(c);
a > -1 && d.splice(a, 1);
};
setTimeout(e, cb);
}
}
function U(a) {
for (var b = a.srcEvent.clientX, c = a.srcEvent.clientY, d = 0; d < this.lastTouches.length; d++) {
var e = this.lastTouches[d], f = Math.abs(b - e.x), g = Math.abs(c - e.y);
if (db >= f && db >= g)
return !0;
}
return !1;
}
function V(a, b) {
this.manager = a, this.set(b);
}
function W(a) {
if (p(a, jb))
return jb;
var b = p(a, kb), c = p(a, lb);
return b && c ? jb : b || c ? b ? kb : lb : p(a, ib) ? ib : hb;
}
function X() {
if (!fb)
return !1;
var b = {}, c = a.CSS && a.CSS.supports;
return [
'auto',
'manipulation',
'pan-y',
'pan-x',
'pan-x pan-y',
'none'
].forEach(function (d) {
b[d] = c ? a.CSS.supports('touch-action', d) : !0;
}), b;
}
function Y(a) {
this.options = la({}, this.defaults, a || {}), this.id = v(), this.manager = null, this.options.enable = l(this.options.enable, !0), this.state = nb, this.simultaneous = {}, this.requireFail = [];
}
function Z(a) {
return a & sb ? 'cancel' : a & qb ? 'end' : a & pb ? 'move' : a & ob ? 'start' : '';
}
function $(a) {
return a == Ma ? 'down' : a == La ? 'up' : a == Ja ? 'left' : a == Ka ? 'right' : '';
}
function _(a, b) {
var c = b.manager;
return c ? c.get(a) : a;
}
function aa() {
Y.apply(this, arguments);
}
function ba() {
aa.apply(this, arguments), this.pX = null, this.pY = null;
}
function ca() {
aa.apply(this, arguments);
}
function da() {
Y.apply(this, arguments), this._timer = null, this._input = null;
}
function ea() {
aa.apply(this, arguments);
}
function fa() {
aa.apply(this, arguments);
}
function ga() {
Y.apply(this, arguments), this.pTime = !1, this.pCenter = !1, this._timer = null, this._input = null, this.count = 0;
}
function ha(a, b) {
return b = b || {}, b.recognizers = l(b.recognizers, ha.defaults.preset), new ia(a, b);
}
function ia(a, b) {
this.options = la({}, ha.defaults, b || {}), this.options.inputTarget = this.options.inputTarget || a, this.handlers = {}, this.session = {}, this.recognizers = [], this.oldCssProps = {}, this.element = a, this.input = y(this), this.touchAction = new V(this, this.options.touchAction), ja(this, !0), g(this.options.recognizers, function (a) {
var b = this.add(new a[0](a[1]));
a[2] && b.recognizeWith(a[2]), a[3] && b.requireFailure(a[3]);
}, this);
}
function ja(a, b) {
var c = a.element;
if (c.style) {
var d;
g(a.options.cssProps, function (e, f) {
d = u(c.style, f), b ? (a.oldCssProps[d] = c.style[d], c.style[d] = e) : c.style[d] = a.oldCssProps[d] || '';
}), b || (a.oldCssProps = {});
}
}
function ka(a, c) {
var d = b.createEvent('Event');
d.initEvent(a, !0, !0), d.gesture = c, c.target.dispatchEvent(d);
}
var la, ma = [
'',
'webkit',
'Moz',
'MS',
'ms',
'o'
], na = b.createElement('div'), oa = 'function', pa = Math.round, qa = Math.abs, ra = Date.now;
la = 'function' != typeof Object.assign ? function (a) {
if (a === d || null === a)
throw new TypeError('Cannot convert undefined or null to object');
for (var b = Object(a), c = 1; c < arguments.length; c++) {
var e = arguments[c];
if (e !== d && null !== e)
for (var f in e)
e.hasOwnProperty(f) && (b[f] = e[f]);
}
return b;
} : Object.assign;
var sa = h(function (a, b, c) {
for (var e = Object.keys(b), f = 0; f < e.length;)
(!c || c && a[e[f]] === d) && (a[e[f]] = b[e[f]]), f++;
return a;
}, 'extend', 'Use `assign`.'), ta = h(function (a, b) {
return sa(a, b, !0);
}, 'merge', 'Use `assign`.'), ua = 1, va = /mobile|tablet|ip(ad|hone|od)|android/i, wa = 'ontouchstart' in a, xa = u(a, 'PointerEvent') !== d, ya = wa && va.test(navigator.userAgent), za = 'touch', Aa = 'pen', Ba = 'mouse', Ca = 'kinect', Da = 25, Ea = 1, Fa = 2, Ga = 4, Ha = 8, Ia = 1, Ja = 2, Ka = 4, La = 8, Ma = 16, Na = Ja | Ka, Oa = La | Ma, Pa = Na | Oa, Qa = [
'x',
'y'
], Ra = [
'clientX',
'clientY'
];
x.prototype = {
handler: function () {
},
init: function () {
this.evEl && m(this.element, this.evEl, this.domHandler), this.evTarget && m(this.target, this.evTarget, this.domHandler), this.evWin && m(w(this.element), this.evWin, this.domHandler);
},
destroy: function () {
this.evEl && n(this.element, this.evEl, this.domHandler), this.evTarget && n(this.target, this.evTarget, this.domHandler), this.evWin && n(w(this.element), this.evWin, this.domHandler);
}
};
var Sa = {
mousedown: Ea,
mousemove: Fa,
mouseup: Ga
}, Ta = 'mousedown', Ua = 'mousemove mouseup';
i(L, x, {
handler: function (a) {
var b = Sa[a.type];
b & Ea && 0 === a.button && (this.pressed = !0), b & Fa && 1 !== a.which && (b = Ga), this.pressed && (b & Ga && (this.pressed = !1), this.callback(this.manager, b, {
pointers: [a],
changedPointers: [a],
pointerType: Ba,
srcEvent: a
}));
}
});
var Va = {
pointerdown: Ea,
pointermove: Fa,
pointerup: Ga,
pointercancel: Ha,
pointerout: Ha
}, Wa = {
2: za,
3: Aa,
4: Ba,
5: Ca
}, Xa = 'pointerdown', Ya = 'pointermove pointerup pointercancel';
a.MSPointerEvent && !a.PointerEvent && (Xa = 'MSPointerDown', Ya = 'MSPointerMove MSPointerUp MSPointerCancel'), i(M, x, {
handler: function (a) {
var b = this.store, c = !1, d = a.type.toLowerCase().replace('ms', ''), e = Va[d], f = Wa[a.pointerType] || a.pointerType, g = f == za, h = r(b, a.pointerId, 'pointerId');
e & Ea && (0 === a.button || g) ? 0 > h && (b.push(a), h = b.length - 1) : e & (Ga | Ha) && (c = !0), 0 > h || (b[h] = a, this.callback(this.manager, e, {
pointers: b,
changedPointers: [a],
pointerType: f,
srcEvent: a
}), c && b.splice(h, 1));
}
});
var Za = {
touchstart: Ea,
touchmove: Fa,
touchend: Ga,
touchcancel: Ha
}, $a = 'touchstart', _a = 'touchstart touchmove touchend touchcancel';
i(N, x, {
handler: function (a) {
var b = Za[a.type];
if (b === Ea && (this.started = !0), this.started) {
var c = O.call(this, a, b);
b & (Ga | Ha) && c[0].length - c[1].length === 0 && (this.started = !1), this.callback(this.manager, b, {
pointers: c[0],
changedPointers: c[1],
pointerType: za,
srcEvent: a
});
}
}
});
var ab = {
touchstart: Ea,
touchmove: Fa,
touchend: Ga,
touchcancel: Ha
}, bb = 'touchstart touchmove touchend touchcancel';
i(P, x, {
handler: function (a) {
var b = ab[a.type], c = Q.call(this, a, b);
c && this.callback(this.manager, b, {
pointers: c[0],
changedPointers: c[1],
pointerType: za,
srcEvent: a
});
}
});
var cb = 2500, db = 25;
i(R, x, {
handler: function (a, b, c) {
var d = c.pointerType == za, e = c.pointerType == Ba;
if (!(e && c.sourceCapabilities && c.sourceCapabilities.firesTouchEvents)) {
if (d)
S.call(this, b, c);
else if (e && U.call(this, c))
return;
this.callback(a, b, c);
}
},
destroy: function () {
this.touch.destroy(), this.mouse.destroy();
}
});
var eb = u(na.style, 'touchAction'), fb = eb !== d, gb = 'compute', hb = 'auto', ib = 'manipulation', jb = 'none', kb = 'pan-x', lb = 'pan-y', mb = X();
V.prototype = {
set: function (a) {
a == gb && (a = this.compute()), fb && this.manager.element.style && mb[a] && (this.manager.element.style[eb] = a), this.actions = a.toLowerCase().trim();
},
update: function () {
this.set(this.manager.options.touchAction);
},
compute: function () {
var a = [];
return g(this.manager.recognizers, function (b) {
k(b.options.enable, [b]) && (a = a.concat(b.getTouchAction()));
}), W(a.join(' '));
},
preventDefaults: function (a) {
var b = a.srcEvent, c = a.offsetDirection;
if (this.manager.session.prevented)
return void b.preventDefault();
var d = this.actions, e = p(d, jb) && !mb[jb], f = p(d, lb) && !mb[lb], g = p(d, kb) && !mb[kb];
if (e) {
var h = 1 === a.pointers.length, i = a.distance < 2, j = a.deltaTime < 250;
if (h && i && j)
return;
}
return g && f ? void 0 : e || f && c & Na || g && c & Oa ? this.preventSrc(b) : void 0;
},
preventSrc: function (a) {
this.manager.session.prevented = !0, a.preventDefault();
}
};
var nb = 1, ob = 2, pb = 4, qb = 8, rb = qb, sb = 16, tb = 32;
Y.prototype = {
defaults: {},
set: function (a) {
return la(this.options, a), this.manager && this.manager.touchAction.update(), this;
},
recognizeWith: function (a) {
if (f(a, 'recognizeWith', this))
return this;
var b = this.simultaneous;
return a = _(a, this), b[a.id] || (b[a.id] = a, a.recognizeWith(this)), this;
},
dropRecognizeWith: function (a) {
return f(a, 'dropRecognizeWith', this) ? this : (a = _(a, this), delete this.simultaneous[a.id], this);
},
requireFailure: function (a) {
if (f(a, 'requireFailure', this))
return this;
var b = this.requireFail;
return a = _(a, this), -1 === r(b, a) && (b.push(a), a.requireFailure(this)), this;
},
dropRequireFailure: function (a) {
if (f(a, 'dropRequireFailure', this))
return this;
a = _(a, this);
var b = r(this.requireFail, a);
return b > -1 && this.requireFail.splice(b, 1), this;
},
hasRequireFailures: function () {
return this.requireFail.length > 0;
},
canRecognizeWith: function (a) {
return !!this.simultaneous[a.id];
},
emit: function (a) {
function b(b) {
c.manager.emit(b, a);
}
var c = this, d = this.state;
qb > d && b(c.options.event + Z(d)), b(c.options.event), a.additionalEvent && b(a.additionalEvent), d >= qb && b(c.options.event + Z(d));
},
tryEmit: function (a) {
return this.canEmit() ? this.emit(a) : void (this.state = tb);
},
canEmit: function () {
for (var a = 0; a < this.requireFail.length;) {
if (!(this.requireFail[a].state & (tb | nb)))
return !1;
a++;
}
return !0;
},
recognize: function (a) {
var b = la({}, a);
return k(this.options.enable, [
this,
b
]) ? (this.state & (rb | sb | tb) && (this.state = nb), this.state = this.process(b), void (this.state & (ob | pb | qb | sb) && this.tryEmit(b))) : (this.reset(), void (this.state = tb));
},
process: function (a) {
},
getTouchAction: function () {
},
reset: function () {
}
}, i(aa, Y, {
defaults: { pointers: 1 },
attrTest: function (a) {
var b = this.options.pointers;
return 0 === b || a.pointers.length === b;
},
process: function (a) {
var b = this.state, c = a.eventType, d = b & (ob | pb), e = this.attrTest(a);
return d && (c & Ha || !e) ? b | sb : d || e ? c & Ga ? b | qb : b & ob ? b | pb : ob : tb;
}
}), i(ba, aa, {
defaults: {
event: 'pan',
threshold: 10,
pointers: 1,
direction: Pa
},
getTouchAction: function () {
var a = this.options.direction, b = [];
return a & Na && b.push(lb), a & Oa && b.push(kb), b;
},
directionTest: function (a) {
var b = this.options, c = !0, d = a.distance, e = a.direction, f = a.deltaX, g = a.deltaY;
return e & b.direction || (b.direction & Na ? (e = 0 === f ? Ia : 0 > f ? Ja : Ka, c = f != this.pX, d = Math.abs(a.deltaX)) : (e = 0 === g ? Ia : 0 > g ? La : Ma, c = g != this.pY, d = Math.abs(a.deltaY))), a.direction = e, c && d > b.threshold && e & b.direction;
},
attrTest: function (a) {
return aa.prototype.attrTest.call(this, a) && (this.state & ob || !(this.state & ob) && this.directionTest(a));
},
emit: function (a) {
this.pX = a.deltaX, this.pY = a.deltaY;
var b = $(a.direction);
b && (a.additionalEvent = this.options.event + b), this._super.emit.call(this, a);
}
}), i(ca, aa, {
defaults: {
event: 'pinch',
threshold: 0,
pointers: 2
},
getTouchAction: function () {
return [jb];
},
attrTest: function (a) {
return this._super.attrTest.call(this, a) && (Math.abs(a.scale - 1) > this.options.threshold || this.state & ob);
},
emit: function (a) {
if (1 !== a.scale) {
var b = a.scale < 1 ? 'in' : 'out';
a.additionalEvent = this.options.event + b;
}
this._super.emit.call(this, a);
}
}), i(da, Y, {
defaults: {
event: 'press',
pointers: 1,
time: 251,
threshold: 9
},
getTouchAction: function () {
return [hb];
},
process: function (a) {
var b = this.options, c = a.pointers.length === b.pointers, d = a.distance < b.threshold, f = a.deltaTime > b.time;
if (this._input = a, !d || !c || a.eventType & (Ga | Ha) && !f)
this.reset();
else if (a.eventType & Ea)
this.reset(), this._timer = e(function () {
this.state = rb, this.tryEmit();
}, b.time, this);
else if (a.eventType & Ga)
return rb;
return tb;
},
reset: function () {
clearTimeout(this._timer);
},
emit: function (a) {
this.state === rb && (a && a.eventType & Ga ? this.manager.emit(this.options.event + 'up', a) : (this._input.timeStamp = ra(), this.manager.emit(this.options.event, this._input)));
}
}), i(ea, aa, {
defaults: {
event: 'rotate',
threshold: 0,
pointers: 2
},
getTouchAction: function () {
return [jb];
},
attrTest: function (a) {
return this._super.attrTest.call(this, a) && (Math.abs(a.rotation) > this.options.threshold || this.state & ob);
}
}), i(fa, aa, {
defaults: {
event: 'swipe',
threshold: 10,
velocity: 0.3,
direction: Na | Oa,
pointers: 1
},
getTouchAction: function () {
return ba.prototype.getTouchAction.call(this);
},
attrTest: function (a) {
var b, c = this.options.direction;
return c & (Na | Oa) ? b = a.overallVelocity : c & Na ? b = a.overallVelocityX : c & Oa && (b = a.overallVelocityY), this._super.attrTest.call(this, a) && c & a.offsetDirection && a.distance > this.options.threshold && a.maxPointers == this.options.pointers && qa(b) > this.options.velocity && a.eventType & Ga;
},
emit: function (a) {
var b = $(a.offsetDirection);
b && this.manager.emit(this.options.event + b, a), this.manager.emit(this.options.event, a);
}
}), i(ga, Y, {
defaults: {
event: 'tap',
pointers: 1,
taps: 1,
interval: 300,
time: 250,
threshold: 9,
posThreshold: 10
},
getTouchAction: function () {
return [ib];
},
process: function (a) {
var b = this.options, c = a.pointers.length === b.pointers, d = a.distance < b.threshold, f = a.deltaTime < b.time;
if (this.reset(), a.eventType & Ea && 0 === this.count)
return this.failTimeout();
if (d && f && c) {
if (a.eventType != Ga)
return this.failTimeout();
var g = this.pTime ? a.timeStamp - this.pTime < b.interval : !0, h = !this.pCenter || H(this.pCenter, a.center) < b.posThreshold;
this.pTime = a.timeStamp, this.pCenter = a.center, h && g ? this.count += 1 : this.count = 1, this._input = a;
var i = this.count % b.taps;
if (0 === i)
return this.hasRequireFailures() ? (this._timer = e(function () {
this.state = rb, this.tryEmit();
}, b.interval, this), ob) : rb;
}
return tb;
},
failTimeout: function () {
return this._timer = e(function () {
this.state = tb;
}, this.options.interval, this), tb;
},
reset: function () {
clearTimeout(this._timer);
},
emit: function () {
this.state == rb && (this._input.tapCount = this.count, this.manager.emit(this.options.event, this._input));
}
}), ha.VERSION = '2.0.7', ha.defaults = {
domEvents: !1,
touchAction: gb,
enable: !0,
inputTarget: null,
inputClass: null,
preset: [
[
ea,
{ enable: !1 }
],
[
ca,
{ enable: !1 },
['rotate']
],
[
fa,
{ direction: Na }
],
[
ba,
{ direction: Na },
['swipe']
],
[ga],
[
ga,
{
event: 'doubletap',
taps: 2
},
['tap']
],
[da]
],
cssProps: {
userSelect: 'none',
touchSelect: 'none',
touchCallout: 'none',
contentZooming: 'none',
userDrag: 'none',
tapHighlightColor: 'rgba(0,0,0,0)'
}
};
var ub = 1, vb = 2;
ia.prototype = {
set: function (a) {
return la(this.options, a), a.touchAction && this.touchAction.update(), a.inputTarget && (this.input.destroy(), this.input.target = a.inputTarget, this.input.init()), this;
},
stop: function (a) {
this.session.stopped = a ? vb : ub;
},
recognize: function (a) {
var b = this.session;
if (!b.stopped) {
this.touchAction.preventDefaults(a);
var c, d = this.recognizers, e = b.curRecognizer;
(!e || e && e.state & rb) && (e = b.curRecognizer = null);
for (var f = 0; f < d.length;)
c = d[f], b.stopped === vb || e && c != e && !c.canRecognizeWith(e) ? c.reset() : c.recognize(a), !e && c.state & (ob | pb | qb) && (e = b.curRecognizer = c), f++;
}
},
get: function (a) {
if (a instanceof Y)
return a;
for (var b = this.recognizers, c = 0; c < b.length; c++)
if (b[c].options.event == a)
return b[c];
return null;
},
add: function (a) {
if (f(a, 'add', this))
return this;
var b = this.get(a.options.event);
return b && this.remove(b), this.recognizers.push(a), a.manager = this, this.touchAction.update(), a;
},
remove: function (a) {
if (f(a, 'remove', this))
return this;
if (a = this.get(a)) {
var b = this.recognizers, c = r(b, a);
-1 !== c && (b.splice(c, 1), this.touchAction.update());
}
return this;
},
on: function (a, b) {
if (a !== d && b !== d) {
var c = this.handlers;
return g(q(a), function (a) {
c[a] = c[a] || [], c[a].push(b);
}), this;
}
},
off: function (a, b) {
if (a !== d) {
var c = this.handlers;
return g(q(a), function (a) {
b ? c[a] && c[a].splice(r(c[a], b), 1) : delete c[a];
}), this;
}
},
emit: function (a, b) {
this.options.domEvents && ka(a, b);
var c = this.handlers[a] && this.handlers[a].slice();
if (c && c.length) {
b.type = a, b.preventDefault = function () {
b.srcEvent.preventDefault();
};
for (var d = 0; d < c.length;)
c[d](b), d++;
}
},
destroy: function () {
this.element && ja(this, !1), this.handlers = {}, this.session = {}, this.input.destroy(), this.element = null;
}
}, la(ha, {
INPUT_START: Ea,
INPUT_MOVE: Fa,
INPUT_END: Ga,
INPUT_CANCEL: Ha,
STATE_POSSIBLE: nb,
STATE_BEGAN: ob,
STATE_CHANGED: pb,
STATE_ENDED: qb,
STATE_RECOGNIZED: rb,
STATE_CANCELLED: sb,
STATE_FAILED: tb,
DIRECTION_NONE: Ia,
DIRECTION_LEFT: Ja,
DIRECTION_RIGHT: Ka,
DIRECTION_UP: La,
DIRECTION_DOWN: Ma,
DIRECTION_HORIZONTAL: Na,
DIRECTION_VERTICAL: Oa,
DIRECTION_ALL: Pa,
Manager: ia,
Input: x,
TouchAction: V,
TouchInput: P,
MouseInput: L,
PointerEventInput: M,
TouchMouseInput: R,
SingleTouchInput: N,
Recognizer: Y,
AttrRecognizer: aa,
Tap: ga,
Pan: ba,
Swipe: fa,
Pinch: ca,
Rotate: ea,
Press: da,
on: m,
off: n,
each: g,
merge: ta,
extend: sa,
assign: la,
inherit: i,
bindFn: j,
prefixed: u
});
var wb = 'undefined' != typeof a ? a : 'undefined' != typeof self ? self : {};
wb.Hammer = ha, 'function' == typeof define && define.amd ? define(function () {
return ha;
}) : 'undefined' != typeof module && module.exports ? module.exports = ha : a[c] = ha;
}(window, document, 'Hammer');
Polymer({
is: 'px-table-row',
behaviors: [
Polymer.IronResizableBehavior,
pxTableRowBehavior,
pxTableRowSwipeBehavior
],
properties: {
item: {
type: Object,
value: {}
},
title: {
type: String,
value: null
},
subtitle: { type: String },
label1: { type: String },
label2: { type: String },
body: { type: String },
image: { type: String },
icon: { type: String },
iconLeft: { type: String },
iconRight: { type: String },
size: { type: String },
iconSize: { type: Number },
indicator: { type: String },
mediaPos: { type: String },
modifier: {
type: String,
notify: true,
reflectToAttribute: true,
observer: '_handleModifier'
},
swipeable: { type: Boolean },
collapsable: { type: Boolean },
editMode: { type: Boolean },
opened: {
type: Boolean,
value: false,
notify: true,
reflectToAttribute: true,
observer: '_handleOpened'
}
},
ready: function () {
this.listen(this.$.row, 'tap', '_handleTap');
},
detached: function () {
this.unlisten(this.$.row, 'tap', '_handleTap');
},
_hideBody: function () {
this.opened = !this.opened;
},
_handleOpened: function (newVal, oldVal) {
this.toggleClass('table-row--collapsable--is-opened', oldVal, this.$$('.table-row'));
this.toggleClass('table-row--collapsable--is-opened', newVal, this.$$('.table-row'));
},
_handleTap: function (e) {
var target = Polymer.dom(e).rootTarget;
if (this.collapsable) {
this._hideBody();
}
this.fire('px-table-row-tap', e);
}
});
Polymer({
is: 'px-table-view',
behaviors: [
Polymer.IronMultiSelectableBehavior,
Polymer.IronResizableBehavior,
pxTableViewBehavior,
pxTableViewPullToRefreshBehavior
],
properties: {
tableData: { type: Array },
modifier: {
type: String,
notify: true,
reflectToAttribute: true,
observer: '_handleModifier'
},
isSortable: {
type: Boolean,
value: false
},
rowModifier: {
type: String,
notify: true,
reflectToAttribute: true,
observer: '_handleRowModifier'
}
},
get rows() {
if (this.$.tableViewContent) {
return Polymer.dom(this.$.tableViewContent).getDistributedNodes();
}
},
_handleModifier: function (newVal, oldVal) {
var _this = this, klass, types;
klass = 'table-view--' + oldVal;
_this.toggleClass(klass, false, _this.$.content);
if (_this.modifier) {
types = _this.modifier.split(' ');
for (var i = 0; i < types.length; i++) {
klass = 'table-view--' + types[i];
_this.toggleClass(klass, true, _this.$.content);
}
}
},
_handleRowModifier: function (newVal, oldVal) {
var rows = this.rows;
var len = rows.length;
var i = 0;
if (newVal) {
for (; i < len; i++) {
rows[i].modifier = newVal;
}
}
}
});
Polymer({
is: 'px-card-header',
properties: {
headerText: { type: String },
icon: { type: String },
chevron: { type: Boolean }
},
attached: function () {
if (this.icon) {
var iconObj = this.$.headericon;
this.toggleClass(this.icon, true, iconObj);
this.toggleClass('fa', true, iconObj);
this.toggleClass('u-mr--', true, iconObj);
}
}
});
(function () {
window.px = window.px || {};
window.px.card = {
properties: {
title: {
type: String,
reflectToAttributes: true
},
context: {
type: Object,
observer: '_contextChanged'
},
url: { type: String },
deckState: {
type: Object,
observer: '_deckStateChanged'
}
},
_contextChanged: function (newContext, oldContext) {
if (this.contextChanged && typeof this.contextChanged === 'function' && this.isInit === true) {
this.contextChanged(newContext, oldContext);
}
},
_deckStateChanged: function (newDealerState, oldDealerState) {
this.fromDeck = true;
if (this.deckStateChanged && typeof this.deckStateChanged === 'function') {
this.deckStateChanged(newDealerState, oldDealerState);
}
this.fromDeck = false;
},
_refresh: function () {
if (this.refresh && typeof this.refresh === 'function') {
this.refresh();
}
},
ready: function () {
this.addEventListener('px-card-refresh', this._refresh);
},
attached: function () {
this.isInit = false;
this.fire('px-card-ready');
if (!this.id) {
throw 'Card ' + this.tagName + ' cannot be created without an id!';
}
},
init: function () {
},
updateDeck: function (value) {
if (!this.fromDeck) {
if (this._deck && this._deck.updateState) {
this._deck.updateState(this.id, value);
} else {
}
} else {
}
},
showCard: function () {
this.hidden = false;
this.querySelector('px-card').hidden = false;
},
hideCard: function () {
this.hidden = true;
this.querySelector('px-card').hidden = true;
},
getData: function () {
return window.px.dealer.getData.apply(window.px.dealer, arguments);
},
getCardAttributes: function () {
var cardState = {};
var cardElement = document.querySelector(this.nodeName);
var cardBehaviors = cardElement.behaviors;
var self = this;
cardBehaviors.forEach(function (behavior) {
for (prop in behavior.properties) {
cardState[px.slugify(prop)] = cardElement[prop];
}
});
for (var prop in cardElement.properties) {
cardState[px.slugify(prop)] = cardElement[prop];
}
return cardState;
},
save: function () {
var state = this.getCardAttributes();
var url = this.url;
if (url) {
var serializedCard = {};
if (state.title) {
serializedCard.title = state.title;
delete state.title;
}
if (state.url) {
delete state.url;
}
delete state.id;
serializedCard.attributes = state;
return window.px.dealer.httpRequest({
method: 'PUT',
url: url,
headers: { 'Content-Type': 'application/json' },
data: serializedCard
});
} else {
throw 'Card url is undefined';
}
}
};
}());
Polymer({
is: 'px-card',
properties: {
headerText: { type: String },
icon: { type: String },
chevron: { type: Boolean }
}
});
Polymer({
is: 'px-alert-message',
properties: {
type: {
type: String,
reflect: true,
value: 'information'
},
messageTitle: {
type: String,
reflect: true
},
message: { type: String },
autoDismiss: {
type: Number,
reflect: true
},
action: {
type: String,
reflect: true
},
_timeouts: {
type: Array,
value: function () {
return [];
}
},
actionText: {
type: String,
computed: '_setActionText(action)'
},
_showDismiss: {
type: String,
computed: '_dismissDisplay(action)'
},
_showButton: {
type: String,
computed: '_buttonDisplay(action)'
},
_isCustom: {
type: String,
computed: '_isCustomType(type)'
},
_isNotCustom: {
type: String,
computed: '_isNotCustomType(type)'
},
_isNotMore: {
type: String,
computed: '_isNotMoreType(type)'
},
_showBtnText: {
type: String,
value: 'Show More'
},
_expandText: {
type: Boolean,
value: false
}
},
attached: function () {
this.listen(this, 'animationend', '_hide');
this.listen(this, 'webkitAnimationEnd', '_hide');
if (this.autoDismiss && this.autoDismiss > 0) {
this.setAutoDismiss(this.autoDismiss);
}
this.listen(this, 'dom-change', '_checkMessageLength');
this._checkMessageLength();
this.listen(this.$.showMoreButton, 'tap', '_isTextExpanded');
},
detached: function () {
this.unlisten(this, 'animationend', '_hide');
this.unlisten(this, 'dom-change', '_checkMessageLength');
this.unlisten(this.$.showMoreButton, 'tap', '_isTextExpanded');
},
setAutoDismiss: function (dismissAfter) {
var _this = this;
if (dismissAfter > 0) {
if (this._timeouts.length > 0) {
for (var i = 0; i < this._timeouts.length; i++) {
clearTimeout(this._timeouts[i]);
}
;
this._timeouts = [];
}
this._timeouts.push(setTimeout(function () {
_this._dismiss();
}, dismissAfter));
this._show();
}
},
_dismissDisplay: function (action) {
return action === 'dismiss';
},
_buttonDisplay: function (action) {
return action !== 'dismiss';
},
_isCustomType: function (type) {
return type === 'custom';
},
_isNotCustomType: function (type) {
return type !== 'custom';
},
_isNotMoreType: function (type) {
return type !== 'more';
},
_dismiss: function () {
this.$.alert.classList.add('fade-out');
},
_hide: function (event) {
if (event.animationName === 'fadeout') {
event.target.classList.add('hidden');
this.fire('px-alert-message-hidden');
}
},
_show: function () {
this.$.alert.classList.remove('fade-out');
this.$.alert.classList.remove('hidden');
},
_isTextExpanded: function () {
this._expandText = !this._expandText;
if (this._expandText) {
this._showMore();
} else {
this._showLess();
}
},
_checkMessageLength: function () {
var messageDiv = this.$.fullMessage, messageTextTitle, messageText;
if (this.type === 'more' || messageDiv.scrollHeight <= messageDiv.offsetHeight) {
return;
}
this.toggleClass('visuallyhidden', false, this.$.showMoreButton);
this._messageTitleOriginal = this._messageTitleOriginal || this.messageTitle;
this._messageOriginal = this._messageOriginal || this.message;
messageTextTitle = this.messageTitle.split(' ');
messageText = this.message.split(' ');
while (messageDiv.scrollHeight > messageDiv.offsetHeight) {
if (messageText.length > 0) {
messageText.pop();
this.message = messageText.join(' ') + '...';
} else {
messageTextTitle.pop();
this.messageTitle = messageTextTitle.join(' ') + '...';
this.message = '';
}
}
this.shortMessageTitle = this.messageTitle;
this.shortMessage = this.message;
},
_showMore: function () {
this.messsageTruncatedHeight = this.$.fullMessage.offsetHeight;
this.$.fullMessage.style.minHeight = this.messsageTruncatedHeight + 'px';
this.$.fullMessage.style.height = this.messsageTruncatedHeight + 'px';
this.$.fullMessage.style.overflow = 'hidden';
this.toggleClass('collapse', false, this.$.fullMessage);
this.messageTitle = this._messageTitleOriginal;
this.message = this._messageOriginal;
this._showBtnText = 'Show Less';
this.$.fullMessage.style.height = this.$.message.offsetHeight + 'px';
},
_showLess: function () {
this.$.fullMessage.style.height = this.messsageTruncatedHeight + 'px';
this._showBtnText = 'Show More';
this.listen(this.$.fullMessage, 'transitionend', '_showLessAfterTransition');
},
_showLessAfterTransition: function () {
this.toggleClass('collapse', true, this.$.fullMessage);
this._checkMessageLength();
this.unlisten(this.$.fullMessage, 'transitionend', '_showLessAfterTransition');
},
_action: function () {
if (this.action.indexOf('http') != -1) {
window.open(this.action);
} else if (this.action === 'dismiss' || this.action === 'acknowledge') {
this._dismiss();
}
},
_setActionText: function (action) {
if (action === 'acknowledge') {
return 'OK';
} else if (action.indexOf('http') != -1) {
return 'Open';
} else {
return '';
}
}
});
Polymer({
is: 'px-pagination',
properties: {
numberOfItems: {
type: Number,
notify: true,
observer: '_goBackToFirstPage'
},
pageSize: {
type: Number,
value: 10,
notify: true,
readOnly: true
},
firstItemIndexToDisplay: {
type: Number,
notify: true,
value: 1,
readOnly: true
}
},
ready: function () {
this.set('itemoftext', 'of');
this.set('pagesizetitle', 'Rows per page');
},
_goBackToFirstPage: function () {
this.goToPageNumber(1);
},
_updateDisplay: function () {
this.set('pageCount', Math.ceil(this.numberOfItems / this.pageSize));
if (this.pageCount === 0) {
this._setFirstItemIndexToDisplay(0);
this.set('lastItemIndexToDisplay', 0);
} else {
this._setFirstItemIndexToDisplay((this.currentPage - 1) * this.pageSize + 1);
if (this.currentPage === this.pageCount) {
this.set('lastItemIndexToDisplay', this.numberOfItems);
} else {
this.set('lastItemIndexToDisplay', this.currentPage * this.pageSize);
}
}
},
goToPreviousPage: function () {
if (this.currentPage > 1) {
this.goToPageNumber(this.currentPage - 1);
}
},
goToNextPage: function () {
if (this.currentPage < this.pageCount) {
this.goToPageNumber(this.currentPage + 1);
}
},
_changeDropDown: function (e) {
var sizelist = [
10,
20,
50,
100
];
var size = parseInt(e.target.value), index = sizelist.indexOf(size);
var parentElem = this.$.pageSizeSelect, optionList = Polymer.dom(parentElem).querySelectorAll('option');
optionList.forEach(function (option) {
if (parseInt(option.value) === parseInt(size)) {
option.setAttribute('selected', '');
e.target.selectedIndex = parseInt(index);
} else {
option.removeAttribute('selected');
}
});
this._setPageSize(size);
this._goBackToFirstPage();
},
goToPageNumber: function (number) {
if (number) {
this.currentPage = number;
this._updateDisplay();
}
},
_goToPage: function (evt) {
this.goToPageNumber(parseInt(evt.target.textContent));
},
_getPageupClass: function (currentPage) {
return [
currentPage === 1 ? 'btn--disabled' : '',
'btn btn--bare btn--pagination u-p- previous'
].join(' ');
},
_getPagedownClass: function (currentPage, pageCount) {
return [
pageCount <= 0 || currentPage === pageCount ? 'btn--disabled' : '',
'btn btn--bare btn--pagination u-p- next'
].join(' ');
},
_getPagerButtonClass: function (buttonValue, currentPage) {
var classList = ['btn'];
if (buttonValue === currentPage) {
classList.push('btn--icon', 'u-ml0', 'btn--pagination--number');
} else {
classList.push('btn--bare', 'u-ml0', 'btn--bare__pagination');
}
return classList.join(' ');
},
_pagerButtons: function () {
if (this.pageCount) {
var noOfPagerButtons = 0, pagerNavButtonsConfig = [], i;
if (this.pageCount <= 9) {
noOfPagerButtons = this.pageCount;
pagerNavButtonsConfig = Array.apply(null, Array(noOfPagerButtons)).map(function (val, index) {
return { val: index + 1 };
});
} else if (this.pageCount <= this.currentPage + 3) {
pagerNavButtonsConfig.push({ val: 1 });
pagerNavButtonsConfig.push({ val: '...' });
for (i = this.pageCount - 6; i <= this.pageCount; i++) {
pagerNavButtonsConfig.push({ val: i });
}
} else {
if (this.currentPage <= 5) {
pagerNavButtonsConfig = Array.apply(null, Array(7)).map(function (val, index) {
return { val: index + 1 };
});
pagerNavButtonsConfig.push({ val: '...' });
pagerNavButtonsConfig.push({ val: this.pageCount });
} else {
pagerNavButtonsConfig.push({ val: 1 });
pagerNavButtonsConfig.push({ val: '...' });
for (i = this.currentPage - 3; i < this.currentPage + 2; i++) {
pagerNavButtonsConfig.push({ val: i });
}
pagerNavButtonsConfig.push({ val: '...' });
pagerNavButtonsConfig.push({ val: this.pageCount });
}
}
return pagerNavButtonsConfig;
}
}
});
Polymer({
is: 'px-tooltip',
behaviors: [Polymer.IronResizableBehavior],
_values: {
TYPE: {
top: 'top',
bottom: 'bottom',
left: 'left',
right: 'right'
}
},
properties: {
for: {
type: Object,
observer: '_onFor',
notify: true,
value: ''
},
delay: {
type: Number,
reflect: true,
value: 1000
},
orientation: {
type: String,
value: 'auto'
},
tooltipMessage: {
type: String,
value: ''
},
smartOrientation: {
type: Boolean,
value: false
},
_isShowing: {
type: Boolean,
value: false
},
_cancel: {
type: Boolean,
value: false
}
},
listeners: { 'iron-resize': '_onIronResize' },
attached: function () {
if (this._target) {
this.listen(this._target, 'mouseenter', '_show');
this.listen(this._target, 'mouseleave', '_hide');
this.listen(this._target, 'mousedown', '_hide');
} else {
this._onFor();
}
},
detached: function () {
this.unlisten(this._target, 'mouseenter', '_show');
this.unlisten(this._target, 'mouseleave', '_hide');
this.unlisten(this._target, 'mousedown', '_hide');
},
_onFor: function () {
if (this._target) {
this.unlisten(this._target, 'mouseenter', '_show');
this.unlisten(this._target, 'mouseleave', '_hide');
}
this.target = this._getTarget();
this._target = this.target;
if (this._target) {
this.listen(this._target, 'mouseenter', '_show');
this.listen(this._target, 'mouseleave', '_hide');
}
},
_onIronResize: function () {
if (this.debounce) {
this.debounce('tooltip-resize', function () {
if (this._isShowing) {
this._setPosition();
}
}, 150);
}
},
_getTarget: function () {
var ownerRoot = Polymer.dom(this).getOwnerRoot(), parentNode = Polymer.dom(this).parentNode, target;
if (this.for && typeof this.for === 'string') {
target = Polymer.dom(parentNode).querySelector('#' + this.for);
} else if (this.for && typeof this.for === 'object') {
target = this.for;
} else if (parentNode.nodeType === 11) {
target = ownerRoot ? ownerRoot.host : null;
} else {
target = parentNode;
}
return target;
},
_timer: null,
_show: function () {
var _this = this;
this.set('_cancel', false);
this._timer = setTimeout(function () {
if (_this._cancel === true) {
return false;
}
_this._isShowing = true;
var tooltip = _this.parentNode.querySelector('px-tooltip');
if (!document.querySelector('.movedTooltip')) {
Polymer.dom(_this).classList.toggle('movedTooltip');
_this.set('tooltipParent', _this.parentNode);
document.body.appendChild(tooltip);
_this._setPosition();
_this.fire('px-tooltip-show', { target: _this });
}
}, this.delay);
},
_clearTimer: function () {
if (this._timer) {
clearTimeout(this._timer);
}
},
_hide: function () {
this.set('_cancel', true);
if (this._isShowing) {
this._clearTimer();
Polymer.dom(this).classList.toggle('movedTooltip');
this.tooltipParent.appendChild(this);
this.$.tooltipWrapper.classList.add('hidden');
this._isShowing = false;
}
},
_setPosition: function () {
if (!this._target) {
return;
}
this.$.carat.style.left = -9999 + 'px';
this.style.left = -9999 + 'px';
this.$.tooltipWrapper.classList.remove('hidden');
this.targetRect = this._target.getBoundingClientRect();
this.thisRect = this.getBoundingClientRect();
this.margin = parseInt(getComputedStyle(this.$.tooltip).marginTop.replace('px', ''));
if (this.orientation === 'auto') {
this._autoPosition();
} else if (this.smartOrientation) {
this._doPosition(this._findValidSmartOrientation(this.orientation));
} else {
this._doPosition(this.orientation);
}
},
_autoPosition: function () {
this._doPosition(this._findValidSmartOrientation(this._values.TYPE.right));
},
_fitOnLeft: function () {
this._styleTheCaratAs(this._values.TYPE.left);
var mostLeft = this.targetRect.left - this._getTooltipWidth() - this._getCaratWidth() - 5;
var mostTop = this.targetRect.top + this.targetRect.height / 2 - this._getTooltipHeight() / 2;
var mostLow = this.targetRect.top + this.targetRect.height / 2 + this._getTooltipHeight() / 2;
return mostLeft > 0 && mostTop > 0 && mostLow < window.innerHeight;
},
_fitOnRight: function () {
this._styleTheCaratAs(this._values.TYPE.right);
var mostRight = this._getTooltipWidth() + this._getCaratWidth() + 5 + this.targetRect.right;
var mostTop = this.targetRect.top + this.targetRect.height / 2 + this._getTooltipHeight() / 2;
var mostLow = this.targetRect.top + this.targetRect.height / 2 - this._getTooltipHeight() / 2;
return mostRight < window.innerWidth && mostTop > 0 && mostLow < window.innerHeight;
},
_fitOnTop: function () {
this._styleTheCaratAs(this._values.TYPE.top);
var mostHigh = this.targetRect.top - this._getTooltipHeight() - this._getCaratHeight() - 5;
var mostRight = this.targetRect.left + this.targetRect.width / 2 + this._getTooltipWidth() / 2;
var mostLeft = this.targetRect.left + this.targetRect.width / 2 - this._getTooltipWidth() / 2;
return mostHigh > 0 && mostRight < window.innerWidth && mostLeft > 0;
},
_fitBelow: function () {
this._styleTheCaratAs(this._values.TYPE.bottom);
var mostLow = this.targetRect.bottom + this._getTooltipHeight() + this._getCaratHeight() + 5;
var mostRight = this.targetRect.left + this.targetRect.width / 2 + this._getTooltipWidth() / 2;
var mostLeft = this.targetRect.left + this.targetRect.width / 2 - this._getTooltipWidth() / 2;
return mostLow < window.innerHeight && mostRight < window.innerWidth && mostLeft > 0;
},
_findValidSmartOrientation: function (startingOrientation) {
var orientationList = [
this._values.TYPE.left,
this._values.TYPE.top,
this._values.TYPE.right,
this._values.TYPE.bottom
], i = 0, index;
switch (startingOrientation) {
case this._values.TYPE.left:
index = 0;
break;
case this._values.TYPE.top:
index = 1;
break;
case this._values.TYPE.right:
index = 2;
break;
case this._values.TYPE.bottom:
index = 3;
break;
}
for (i = 0; i < 4; i++) {
if (this._orientationFit(orientationList[index])) {
return orientationList[index];
}
index = (index + 1) % 4;
}
return startingOrientation;
},
_orientationFit: function (orientation) {
switch (orientation) {
case this._values.TYPE.right:
return this._fitOnRight();
break;
case this._values.TYPE.left:
return this._fitOnLeft();
break;
case this._values.TYPE.top:
return this._fitOnTop();
break;
case this._values.TYPE.bottom:
return this._fitBelow();
break;
}
},
_doPosition: function (orientation) {
switch (orientation) {
case this._values.TYPE.right:
this._positionRight();
break;
case this._values.TYPE.left:
this._positionLeft();
break;
case this._values.TYPE.top:
this._positionTop();
break;
case this._values.TYPE.bottom:
this._positionBottom();
break;
}
},
_positionTop: function () {
this._styleTheCaratAs(this._values.TYPE.top);
this.$.carat.style.left = this._getTooltipWidth() / 2 - this._getCaratWidth() / 2 + 'px';
this.$.carat.style.top = this._getTooltipHeight() - this.margin + 'px';
this.style.left = this.getTargetPositionCenterOfLeftRight() - this._getTooltipWidth() / 2 + 'px';
this.style.top = this._getTargetPositionTop() - this._getTooltipHeight() + this.margin / 2 - 5 + 'px';
},
_positionBottom: function () {
this._styleTheCaratAs(this._values.TYPE.bottom);
this.$.carat.style.left = this._getTooltipWidth() / 2 - this._getCaratWidth() / 2 + 'px';
this.$.carat.style.top = null;
this.style.left = this.getTargetPositionCenterOfLeftRight() - this._getTooltipWidth() / 2 + 'px';
this.style.top = this._getTargetPositionBottom() - this._getCaratHeight() + 5 + 'px';
},
_positionLeft: function () {
var top;
this._styleTheCaratAs(this._values.TYPE.left);
this.$.carat.style.left = null;
this.$.carat.style.top = this._getTooltipHeight() / 2 - this._getCaratWidth() + 'px';
top = Math.round(this.getTargetPositionCenterOfTopBottom() - this._getTooltipHeight() / 2) + 'px';
this.style.left = this._getTargetPositionLeft() - this._getTooltipWidth() + this.margin / 2 - 5 + 'px';
this.style.top = top;
},
_positionRight: function () {
var top;
this._styleTheCaratAs(this._values.TYPE.right);
this.$.carat.style.left = null;
this.$.carat.style.top = this._getTooltipHeight() / 2 - this._getCaratWidth() + 'px';
top = Math.round(this.getTargetPositionCenterOfTopBottom() - this._getTooltipHeight() / 2) + 'px';
this.style.left = this._getTargetPositionRight() - this._getCaratWidth() + 5 + 'px';
this.style.top = top;
},
_styleTheCaratAs: function (newCaratState) {
this.$.carat.classList.remove(this._values.TYPE.top, this._values.TYPE.bottom, this._values.TYPE.left, this._values.TYPE.right);
this.$.carat.classList.add(newCaratState);
this.updateStyles();
this.caratRect = this.$.carat.getBoundingClientRect();
},
_getTargetPositionTop: function () {
return this._getTargetPosition('top', 'pageYOffset');
},
_getTargetPositionBottom: function () {
return this._getTargetPositionTop() + this.targetRect.height;
},
_getTargetPositionLeft: function (smartOrientation) {
return this._getTargetPosition('left', 'pageXOffset');
},
_getTargetPositionRight: function () {
return this._getTargetPositionLeft() + this.targetRect.width;
},
getTargetPositionCenterOfTopBottom: function () {
return this._getTargetPositionTop() + this.targetRect.height / 2;
},
getTargetPositionCenterOfLeftRight: function (smartOrientation) {
return this._getTargetPositionLeft() + this.targetRect.width / 2;
},
_getTargetPosition: function (topOrLeft, pageXOrYOffset) {
var position = this.targetRect[topOrLeft];
position += window[pageXOrYOffset];
return position;
},
_getTooltipWidth: function () {
return this.thisRect.width;
},
_getTooltipHeight: function () {
return this.thisRect.height;
},
_getCaratHeight: function () {
return this.caratRect.height;
},
_getCaratWidth: function () {
return this.caratRect.width;
}
});
Polymer({
is: 'px-edit-cell',
properties: {
keyEventTarget: {
type: Object,
value: function () {
return this;
}
}
},
behaviors: [Polymer.IronA11yKeysBehavior],
keyBindings: {
'enter': '_cellExitKeyPress',
'esc': '_cellUndoKeyPress'
},
_cellExitKeyPress: function () {
this.fire('exit-edit-mode');
},
_cellUndoKeyPress: function () {
this.fire('undo-edit-mode');
}
});
(function () {
'use strict';
Polymer.IronDropdownScrollManager = {
get currentLockingElement() {
return this._lockingElements[this._lockingElements.length - 1];
},
elementIsScrollLocked: function (element) {
var currentLockingElement = this.currentLockingElement;
if (currentLockingElement === undefined)
return false;
var scrollLocked;
if (this._hasCachedLockedElement(element)) {
return true;
}
if (this._hasCachedUnlockedElement(element)) {
return false;
}
scrollLocked = !!currentLockingElement && currentLockingElement !== element && !this._composedTreeContains(currentLockingElement, element);
if (scrollLocked) {
this._lockedElementCache.push(element);
} else {
this._unlockedElementCache.push(element);
}
return scrollLocked;
},
pushScrollLock: function (element) {
if (this._lockingElements.indexOf(element) >= 0) {
return;
}
if (this._lockingElements.length === 0) {
this._lockScrollInteractions();
}
this._lockingElements.push(element);
this._lockedElementCache = [];
this._unlockedElementCache = [];
},
removeScrollLock: function (element) {
var index = this._lockingElements.indexOf(element);
if (index === -1) {
return;
}
this._lockingElements.splice(index, 1);
this._lockedElementCache = [];
this._unlockedElementCache = [];
if (this._lockingElements.length === 0) {
this._unlockScrollInteractions();
}
},
_lockingElements: [],
_lockedElementCache: null,
_unlockedElementCache: null,
_originalBodyStyles: {},
_isScrollingKeypress: function (event) {
return Polymer.IronA11yKeysBehavior.keyboardEventMatchesKeys(event, 'pageup pagedown home end up left down right');
},
_hasCachedLockedElement: function (element) {
return this._lockedElementCache.indexOf(element) > -1;
},
_hasCachedUnlockedElement: function (element) {
return this._unlockedElementCache.indexOf(element) > -1;
},
_composedTreeContains: function (element, child) {
var contentElements;
var distributedNodes;
var contentIndex;
var nodeIndex;
if (element.contains(child)) {
return true;
}
contentElements = Polymer.dom(element).querySelectorAll('content');
for (contentIndex = 0; contentIndex < contentElements.length; ++contentIndex) {
distributedNodes = Polymer.dom(contentElements[contentIndex]).getDistributedNodes();
for (nodeIndex = 0; nodeIndex < distributedNodes.length; ++nodeIndex) {
if (this._composedTreeContains(distributedNodes[nodeIndex], child)) {
return true;
}
}
}
return false;
},
_scrollInteractionHandler: function (event) {
var scrolledElement = Polymer.dom(event).rootTarget;
if (Polymer.IronDropdownScrollManager.elementIsScrollLocked(scrolledElement)) {
if (event.type === 'keydown' && !Polymer.IronDropdownScrollManager._isScrollingKeypress(event)) {
return;
}
event.preventDefault();
}
},
_lockScrollInteractions: function () {
this._originalBodyStyles.overflow = document.body.style.overflow;
this._originalBodyStyles.overflowX = document.body.style.overflowX;
this._originalBodyStyles.overflowY = document.body.style.overflowY;
document.body.style.overflow = 'hidden';
document.body.style.overflowX = 'hidden';
document.body.style.overflowY = 'hidden';
document.addEventListener('wheel', this._scrollInteractionHandler, true);
document.addEventListener('mousewheel', this._scrollInteractionHandler, true);
document.addEventListener('DOMMouseScroll', this._scrollInteractionHandler, true);
document.addEventListener('touchmove', this._scrollInteractionHandler, true);
document.addEventListener('keydown', this._scrollInteractionHandler, true);
},
_unlockScrollInteractions: function () {
document.body.style.overflow = this._originalBodyStyles.overflow;
document.body.style.overflowX = this._originalBodyStyles.overflowX;
document.body.style.overflowY = this._originalBodyStyles.overflowY;
document.removeEventListener('wheel', this._scrollInteractionHandler, true);
document.removeEventListener('mousewheel', this._scrollInteractionHandler, true);
document.removeEventListener('DOMMouseScroll', this._scrollInteractionHandler, true);
document.removeEventListener('touchmove', this._scrollInteractionHandler, true);
document.removeEventListener('keydown', this._scrollInteractionHandler, true);
}
};
}());
Polymer({
is: 'px-dropdown-content',
properties: {
items: {
type: Array,
notify: true,
value: function () {
return [];
}
},
computedItems: {
type: Array,
value: function () {
return [];
},
computed: '_computedItems(items, items.*)'
},
selectionOccured: {
type: Boolean,
value: false,
readOnly: true
},
menuOpen: {
type: Boolean,
notify: true,
value: false
},
maxContCharacterWidth: {
type: Number,
value: 0,
observer: '_maxContCharacterWidthChanged'
},
extendDropdown: {
type: Boolean,
value: false
},
extendDropdownBy: {
type: Number,
value: 15
},
extended: {
type: Boolean,
value: false
},
dropCellWidth: {
type: Number,
value: 0,
observer: '_dropCellWidthChanged'
},
dropCellHeight: {
type: Number,
value: 0,
observer: '_dropCellHeightChanged'
},
allowOutsideScroll: {
type: Boolean,
value: false
},
checkboxMode: {
type: Boolean,
value: false
}
},
_maxContCharacterWidthChanged: function (newValue) {
if (newValue) {
this.fire('maxContCharacterWidth', { maxContCharacterWidth: this.maxContCharacterWidth });
}
},
open: function () {
this.menuOpen = true;
if (!this.allowOutsideScroll) {
var currentHeight = parseInt(this.$.dropdown.getBoundingClientRect().height);
if (currentHeight < this.$.dropdown.scrollHeight) {
Polymer.IronDropdownScrollManager.pushScrollLock(this.$.dropdown);
}
}
this.fire('dropdown_content_request_size', { pxContent: this });
},
_dropCellWidthChanged: function (newValue, oldValue) {
if (newValue) {
this._setWidth();
}
},
_dropCellHeightChanged: function (newValue, oldValue) {
if (newValue) {
this.adjustHeight();
}
},
_checkChanged: function (evt) {
this._checkboxChanged(evt.target);
},
_checkboxChanged: function (checkbox) {
var itemVal = Polymer.dom(checkbox).parentNode.textContent;
this.items.forEach(function (item, index) {
if (item.val === itemVal) {
this.set('items.' + index + '.checked', checkbox.checked);
}
}.bind(this));
},
close: function () {
this.menuOpen = false;
Polymer.IronDropdownScrollManager.removeScrollLock(this.$.dropdown);
},
sizeHeight: function (maxHeight) {
var currentHeight = parseInt(this.$.dropdown.getBoundingClientRect().height);
if (currentHeight > maxHeight) {
this.$.dropdown.style.height = maxHeight + 'px';
} else {
this.adjustHeight();
}
},
resetHeight: function () {
this.$.dropdown.style.height = '';
},
_includeTooltip: function (value) {
var maxContWidth = this.maxContCharacterWidth;
if (value === null || value === undefined || typeof value === 'string' && value.trim().length === 0) {
return false;
}
return maxContWidth !== undefined && maxContWidth !== null && maxContWidth !== 0 ? value.length > maxContWidth : false;
},
_clickItem: function (evt) {
this._clickFire(evt);
if (this.checkboxMode) {
var checkbox = Polymer.dom(evt.target).querySelector('input');
if (checkbox) {
checkbox.checked = !checkbox.checked;
this._checkboxChanged(checkbox);
}
} else {
var el = evt.target, child = el.firstChild, text;
while (child && !text) {
if (child.nodeType == 3) {
text = child.data;
}
child = child.nextSibling;
}
this.close();
this.fire('dropdown_flip', true);
this._setSelectionOccured(true);
this.fire('dropdown_content_value_changed', { textValue: text });
}
},
_clickFire: function (evt) {
this.fire('px-dropdown-click', evt);
},
_setWidth: function () {
if (this.extendDropdown) {
this.$.dropdown.style.width = this.dropCellWidth + parseInt(this.extendDropdownBy) + 'px';
} else {
this.$.dropdown.style.width = this.dropCellWidth + 'px';
}
},
adjustHeight: function () {
var currentHeight = parseInt(this.$.dropdown.getBoundingClientRect().height);
if (currentHeight < this.$.dropdown.scrollHeight) {
var reduceBy = parseInt(this.dropCellHeight / 2);
this.$.dropdown.style.height = currentHeight - reduceBy + 'px';
}
},
_computedItems: function (items) {
if (typeof this.items[0] === 'string') {
var len = items.length, i = 0, computedItemsArr = [];
for (i; i < len; i++) {
if (this.checkboxMode) {
computedItemsArr.push({
val: items[i],
checked: false
});
} else {
computedItemsArr.push({ val: items[i] });
}
}
return computedItemsArr;
} else {
var computedItemsArr = [];
items.forEach(function (item, index) {
computedItemsArr.push(item);
});
return computedItemsArr;
}
}
});
Polymer({
is: 'px-dropdown-chevron',
properties: {
hover: {
type: Boolean,
value: false,
notify: true
},
opened: {
type: Boolean,
value: false,
notify: true
}
},
listeners: {
'hoverOff': '_manipulateHoverOff',
'hoverOn': '_manipulateHoverOn',
'opened': '_manipulateOpened'
},
_manipulateOpened: function (evt) {
evt.stopPropagation();
this.opened = !this.opened;
},
_manipulateHoverOff: function (evt) {
evt.stopPropagation();
this.hover = false;
},
_manipulateHoverOn: function (evt) {
evt.stopPropagation();
this.hover = true;
},
_chevronClass: function () {
if (this.opened) {
return 'opened';
} else if (this.hover) {
return 'hover';
}
}
});
Polymer({
is: 'px-dropdown-text',
properties: {
displayValue: {
type: String,
notify: true,
value: ''
},
tooltipValue: {
type: String,
notify: true,
value: ''
},
maxContCharacterWidth: {
type: Number,
notify: true,
value: 0
}
},
_includeTooltip: function () {
return this.tooltipValue.length > this.maxContCharacterWidth;
}
});
Polymer({
is: 'px-dropdown',
properties: {
opened: {
type: Boolean,
notify: true,
value: false
},
hover: {
type: Boolean,
notify: true,
value: false
},
above: {
type: Boolean,
value: false
},
hideChevron: {
type: Boolean,
value: false
},
boundTarget: {
type: HTMLElement,
value: null
},
preventCloseOnOutsideClick: {
type: Boolean,
value: false
},
displayValue: {
type: String,
notify: true,
value: ''
},
_maxCharWidth: {
type: Number,
notify: true,
value: 0
},
contentAnchor: {
type: HTMLElement,
value: function () {
return null;
}
},
value: {
type: String,
value: '',
notify: true
}
},
observers: ['_boundTargetChanged(boundTarget, isAttached)'],
listeners: {
'dropdown_flip': '_flipOpened',
'dropdown_content_request_size': '_provideCellSize',
'dropdown_content_value_changed': '_newTextValue',
'maxContCharacterWidth': '_newMaxContCharWidth'
},
attached: function () {
Polymer.Gestures.add(document, 'tap', null);
var tapEvent = 'ontouchstart' in window ? 'tap' : 'click';
document.addEventListener(tapEvent, this._onCaptureClick.bind(this), true);
if (!this.value && this.displayValue) {
this.set('value', this.displayValue);
}
},
detached: function () {
var tapEvent = 'ontouchstart' in window ? 'tap' : 'click';
document.removeEventListener(tapEvent, this._onCaptureClick.bind(this));
},
_newTextValue: function (evt) {
this.set('value', evt.detail.textValue);
this.set('displayValue', evt.detail.textValue);
this.fire('change');
evt.stopPropagation();
},
_newMaxContCharWidth: function (evt) {
this.set('_maxCharWidth', evt.detail.maxContCharacterWidth);
evt.stopPropagation();
},
_provideCellSize: function (evt) {
var dropcell = this.contentAnchor ? this.contentAnchor : this.$.dropcell, rect = dropcell.getBoundingClientRect();
evt.detail.pxContent.dropCellWidth = rect.width;
evt.detail.pxContent.dropCellHeight = rect.height;
evt.stopPropagation();
},
_hideChevron: function (newValue) {
return !this.hideChevron;
},
_selfInPath: function (path) {
path = path || [];
for (var i = 0; i < path.length; i++) {
if (path[i] === this) {
return this;
}
}
},
_onCaptureClick: function (evt) {
if (!this.preventCloseOnOutsideClick && !this._selfInPath(Polymer.dom(evt).path) && this.opened) {
var content = Polymer.dom(this).querySelector('px-dropdown-content');
this._flipOpened();
content.close();
this._reset();
}
},
_boundTargetChanged: function (boundTarget, isAttached) {
if (typeof boundTarget === 'string') {
this.boundTarget = this.domHost ? this.domHost.$[boundTarget] : Polymer.dom(this.ownerDocument).querySelector('#' + boundTarget);
}
},
_computeValue: function (displayValue) {
return displayValue;
},
triggerClicked: function (evt) {
var content = Polymer.dom(this).querySelector('px-dropdown-content');
if (!this.opened) {
content.open();
this._setPosition();
} else {
content.close();
this._reset();
}
this._flipOpened();
this.fire('dropdownStateChanged', evt);
},
_flipOpened: function (evt) {
this._fireChevron('opened');
this.opened = !this.opened;
if (evt) {
evt.stopPropagation();
}
},
_fireChevron: function (fireEvent) {
var chevron = this.$$('px-dropdown-chevron');
if (chevron) {
chevron.fire(fireEvent);
}
},
_dropcellClass: function (opened, hover) {
if (this.opened) {
return 'opened';
} else if (this.hover) {
return 'hover';
}
},
_hoverOn: function () {
this._fireChevron('hoverOn');
this.hover = true;
},
_hoverOff: function () {
this._fireChevron('hoverOff');
this.hover = false;
},
_reset: function () {
var content = Polymer.dom(this).querySelector('px-dropdown-content'), dropdown = content.$.dropdown;
this.above = false;
dropdown.style.top = '';
},
_setPosition: function () {
this._reset();
this._positionOnContentAnchor();
if (this.boundTarget !== null) {
this.positionWithinBounds(this.boundTarget.getBoundingClientRect());
} else if (this._isoffScreenOnBottom()) {
this._setTopPosition();
}
},
_positionOnContentAnchor: function () {
if (this.contentAnchor) {
var content = Polymer.dom(this).querySelector('px-dropdown-content'), dropdown = content.$.dropdown, anchorRect = this.contentAnchor.getBoundingClientRect(), dropcellRect = this.$.dropcell.getBoundingClientRect();
dropdown.style.left = anchorRect.left - dropcellRect.left + 'px';
dropdown.style.top = anchorRect.bottom - dropcellRect.bottom + 'px';
}
},
_isoffScreenOnBottom: function () {
var content = Polymer.dom(this).querySelector('px-dropdown-content'), dropdown = content.$.dropdown, dropdownRect = dropdown.getBoundingClientRect(), contentRect = content.getBoundingClientRect(), dropdownBottomPoint = dropdownRect.bottom;
return dropdownBottomPoint > window.innerHeight;
},
positionWithinBounds: function (parentBoundingRect) {
var content = Polymer.dom(this).querySelector('px-dropdown-content'), dropdown = content.$.dropdown, dropcell = this.contentAnchor ? this.contentAnchor : this.$.dropcell, dropcellRect = dropcell.getClientRects()[0], dropdownRect, dropdownBottomPoint, sizeAbove, sizeBelow;
content.resetHeight();
dropdownRect = dropdown.getBoundingClientRect();
dropdownBottomPoint = dropdownRect.bottom, sizeAbove = dropdownRect.top - parentBoundingRect.top - parseInt(dropcellRect.height), sizeBelow = parentBoundingRect.bottom - dropdownRect.top;
if (dropdownBottomPoint > parentBoundingRect.bottom) {
if (sizeAbove > dropdownRect.height) {
content.adjustHeight();
this._setTopPosition();
} else {
if (sizeAbove > sizeBelow) {
content.sizeHeight(sizeAbove - 1);
this._setTopPosition();
} else {
content.sizeHeight(sizeBelow - 1);
}
}
}
},
_setTopPosition: function () {
var content = Polymer.dom(this).querySelector('px-dropdown-content'), dropdown = content.$.dropdown, dropdownRect = dropdown.getClientRects()[0], dropcell = this.contentAnchor ? this.contentAnchor : this.$.dropcell, dropcellRect = dropcell.getClientRects()[0], newTop = parseInt(dropdown.offsetTop) - parseInt(dropdownRect.height) - parseInt(dropcellRect.height) + 'px';
dropdown.style.top = newTop;
this.above = true;
}
});
Polymer({
is: 'px-data-table-cell',
properties: {
cellType: {
type: String,
value: ''
},
cellDisplayValue: {
type: String,
value: '',
observer: '_cellDisplayValueChanged'
},
cellValue: {
type: String,
value: ''
},
cellDisplayTooltip: {
type: Boolean,
value: false
},
cellValidation: {
type: Object,
value: function () {
return { passedValidation: true };
},
notify: true
},
columnName: {
type: String,
value: ''
},
_editing: {
type: Boolean,
value: false,
notify: true
},
cellEditable: {
type: Boolean,
value: false
},
dropdownItems: {
type: Array,
value: function () {
return [];
},
notify: true,
observer: '_setDropdownItem'
},
dropdownBounds: {
type: HTMLElement,
value: null
},
cellSelected: {
type: Boolean,
value: false,
observer: '_cellSelected'
},
cellHighlighted: {
type: Object,
value: function () {
return { value: false };
}
},
rowHighlighted: {
type: Object,
value: function () {
return { value: false };
}
},
dropdownMaxCharacterWidth: {
type: Number,
value: 0
},
_showEditIcon: {
type: Boolean,
value: false
},
_editTimeout: {
type: Object,
value: function () {
return {};
}
},
_dropdownItem: {
type: Boolean,
value: false
},
_cellAnchor: {
type: HTMLElement,
value: function () {
return null;
}
}
},
listeners: { 'tap': 'editCell' },
observers: ['_updateHighlight(cellHighlighted.value, rowHighlighted.value)'],
_cellDisplayValueChanged: function (newValue) {
if (this.$$('.cell--value') !== undefined && this.$$('.cell--value') !== null) {
if (newValue !== undefined && newValue !== '') {
this.$$('.cell--value').classList.remove('empty');
} else {
this.$$('.cell--value').classList.add('empty');
}
}
},
_cellValueChanged: function (evt) {
clearTimeout(this._editTimeout);
this._editTimeout = setTimeout(function () {
this.fire('validate', { newValue: this.$$('#celleditinput').value });
}.bind(this), 300);
},
onCellHovered: function (evt) {
this.set('_showEditIcon', this.cellEditable);
},
onCellUnHovered: function (evt) {
this.set('_showEditIcon', false);
},
_isEqual: function (source, target) {
if (!Array.isArray(target) || typeof target !== 'object') {
return source === target;
}
return;
},
isNotEqual: function (source, target) {
if (!Array.isArray(target) || typeof target !== 'object') {
return source !== target;
}
return;
},
_areAnyEqual: function (source, arr) {
if (Array.isArray(arr)) {
var flag = false, i = 0, len = arr.length;
for (; i < len; i++) {
if (source === arr[i]) {
return true;
}
}
return false;
} else {
console.log('You must pass an array into this function');
return false;
}
},
_getReaderClass: function () {
var datum = this.cellValue, classList = [];
classList = this.cellType === 'dropdown' ? [
'flex',
'ddviewing'
] : [
'flex',
'viewing'
];
if (datum === null || datum === undefined || typeof datum === 'string' && datum.trim().length === 0) {
classList.push('empty');
}
return classList.join(' ');
},
ready: function () {
this.addEventListener('exit-edit-mode', this._exitEditMode.bind(this));
this.addEventListener('undo-edit-mode', this._undoEditMode.bind(this));
this.addEventListener('setDropdownItem', this._setDropdownItem), this.toggleClass('td', true);
this.toggleClass('aha-' + this.columnName + '-td', true);
},
attached: function () {
this.toggleClass('td__dropdown', this._dropdownItem);
this._cellAnchor = this;
},
_setDropdownItem: function () {
this.set('_dropdownItem', this.dropdownItems.length > 0);
},
_exitEditMode: function () {
document.activeElement.blur();
},
_undoEditMode: function (evt) {
this.set('_cancelSave', true);
document.activeElement.blur();
},
editCell: function () {
var editCell = this.$$('.cell--edit'), valueCell = this.$$('.cell--value');
if (this.cellEditable && this.cellType !== 'dropdown') {
this.set('_editing', true);
this.toggleClass('cell__edit', this._editing);
this.set('_undoValue', this.$$('.cell--value').innerText);
Polymer.dom(editCell).querySelector('input,select,textarea').focus();
}
},
saveCell: function (evt) {
this._editing = false;
this.toggleClass('cell__edit', this._editing);
var value;
if (this._cancelSave === true) {
this.set('_cancelSave', false);
value = this._undoValue;
Polymer.dom(this.$$('.cell--edit')).querySelector('input,select,textarea').value = value;
} else {
value = evt.target.value;
}
this.fire('save', { newValue: value });
},
_getEditCellClass: function (editing) {
var classList = ['cell--edit'];
if (!editing) {
classList.push('visuallyhidden');
}
return classList.join(' ');
},
_getValueCellClass: function (editing, valid, cellDisplayValue) {
var classList = ['cell--value'];
if (editing) {
classList.push('visuallyhidden');
}
if (!cellDisplayValue) {
classList.push('cell--value__empty');
}
this.toggleClass('cell--value__validation-failed', !valid);
return classList.join(' ');
},
_getCellIcon: function (showEditIcon, editing, valid) {
if (valid) {
if (showEditIcon) {
return 'polymer-font-awesome:fa-pencil';
}
} else {
return 'polymer-font-awesome:fa-warning';
}
},
_getCellIconClass: function (showEditIcon, editing, valid) {
var classList = ['cell--status--container--icon'];
if (!valid) {
classList.push('cell--value--icon__validation-failed');
} else {
if (editing || !showEditIcon) {
classList.push('visuallyhidden');
}
}
return classList.join(' ');
},
_cellSelected: function (selected) {
if (this.rowHighlighted && this.rowHighlighted.value) {
this.toggleClass('cell--value__highlight--selected__row', selected);
} else if (this.cellHighlighted && this.cellHighlighted.value) {
this.toggleClass('cell--value__highlight--selected', selected);
} else {
this.toggleClass('selected', selected);
}
},
_updateHighlight: function (cellHighlight, rowHighlight) {
this._clearHighlight();
if (rowHighlight) {
this.toggleClass(this.rowHighlighted.highlightClass, rowHighlight);
}
if (cellHighlight) {
this.toggleClass(this.cellHighlighted.highlightClass, cellHighlight);
}
},
_clearHighlight: function () {
this.toggleClass('cell--value__highlight--color__high', false);
this.toggleClass('cell--value__highlight--color__medium', false);
this.toggleClass('cell--value__highlight--color__low', false);
}
});
Polymer({
is: 'aha-html-echo',
properties: {
html: {
type: String,
value: '',
observer: 'onHtmlChanged'
}
},
onHtmlChanged: function () {
if (!this.html) {
this.html = '';
}
this.innerHTML = this.html;
}
});
Polymer({
is: 'aha-table',
properties: {
data: {
type: Array,
notify: true,
value: function () {
return [];
}
},
meta: {
type: Array,
value: function () {
return [];
}
},
selectedRows: {
type: Array,
value: function () {
return [];
},
notify: true
},
selectable: {
type: Boolean,
value: false,
observer: '_selectableChanged'
},
striped: {
type: Boolean,
value: false
},
tableRows: {
type: Boolean,
value: false
},
tableColumns: {
type: Boolean,
value: false
},
filterable: {
type: Boolean,
value: false
},
_enableFilterRow: {
type: Boolean,
value: false
},
sortedColumn: {
type: String,
value: ''
},
filteredColumns: {
type: Array,
value: function () {
return [];
}
},
displayedRows: {
type: Array,
value: function () {
return [];
}
},
descending: {
type: Boolean,
value: false
},
hidePaginationControl: {
type: Boolean,
value: false
},
showColumnChooser: {
type: Boolean,
value: false
},
enableColumnReorder: {
type: Boolean,
value: false
},
enableColumnResize: {
type: Boolean,
value: false
},
_internalData: {
type: Array,
value: function () {
return [];
}
},
_columnChooserItems: {
type: Array,
computed: '_computeColumnChooserItems(meta, meta.*)'
},
_displayingInsertion: {
type: Boolean,
value: false
},
_requestInsertionIndicatorRemoval: {
type: Boolean,
value: false
},
_headerInitialSize: {
type: Number,
value: 0
},
_columnDragged: {
type: String,
value: ''
},
_isAttached: {
type: Boolean,
value: false
},
scrollBody: {
type: HTMLElement,
value: function () {
Polymer.dom(this.root).querySelector('#scrollBodyTableContainer');
}
}
},
observers: [
'_updateDisplayedRows(firstItemIndex)',
'_updateDisplayedRows(pageSize)',
'_dataChanged(data.*)',
'_columnChooserChanged(_columnChooserItems.*)',
'_computeIfColumnFilterEnabled(meta.splices, filterable, meta.*, selectable)'
],
ready: function () {
this.addEventListener('px-data-table-highlight-loaded', this._highlightLoaded.bind(this));
this.scrollBody = Polymer.dom(this.root).querySelector('#scrollBodyTableContainer');
var boundHandler = this._columnChanged.bind(this);
this._observer = Polymer.dom(this.$.columndefs).observeNodes(boundHandler);
},
attached: function () {
this._isAttached = true;
},
_columnChanged: function (info) {
var addedColumns = info.addedNodes.filter(function (node) {
return node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'PX-DATA-TABLE-COLUMN';
});
var removedColumns = info.removedNodes.filter(function (node) {
return node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'PX-DATA-TABLE-COLUMN';
});
if (addedColumns.length > 0) {
if (this.selectable && !this._selectedColumnExists()) {
this.push('meta', this._generateMetaForColumn('_selected', 'selected', true, 'Selected (0)'));
}
for (var i = 0; i < addedColumns.length; i++) {
if (!addedColumns[i].type) {
addedColumns[i].type = 'string';
}
if (!addedColumns[i]['label']) {
var name = addedColumns[i]['name'] || '';
addedColumns[i].label = name.charAt(0).toUpperCase() + name.slice(1);
}
this._addColumn(addedColumns[i]);
}
}
removedColumns.forEach(function (columnToRemove) {
this.meta.forEach(function (column, idx) {
if (columnToRemove === column) {
this.splice('meta', idx, 1);
}
}.bind(this));
}.bind(this));
},
_addColumn: function (addedColumn) {
var previousNode, notFound = this.getEffectiveChildren().every(function (column, index) {
if (column.name === addedColumn.name) {
return false;
}
previousNode = column;
return true;
});
if (!notFound) {
var idx = 0;
if (previousNode) {
this.meta.forEach(function (column, index) {
if (column.name === previousNode.name) {
idx = index + 1;
}
});
} else {
idx = this.selectable ? 1 : 0;
}
this.splice('meta', idx, 0, addedColumn);
} else {
this.push('meta', addedColumn);
}
},
_selectedColumnExists: function () {
return this.meta[0] && this.meta[0].name === '_selected';
},
_highlightLoaded: function (evt) {
evt = Polymer.dom(evt);
var column = this._findFirstMatchingElementNameFromEventPath(evt, 'PX-DATA-TABLE-COLUMN');
column._highLightElLoadedCount += 1;
if (column._highLightElLoadedCount === Polymer.dom(column).querySelectorAll('px-data-table-highlight').length) {
var columnIndex = this._findMetaIndexFromColumnElement(column);
if (columnIndex > 0) {
this.set('meta.' + columnIndex + '.highlightdefined', true);
}
}
},
_findMetaIndexFromColumnElement: function (columnElement) {
var columnIndex = -1;
this.meta.some(function (item, idx) {
if (item === columnElement) {
columnIndex = idx;
return true;
}
});
return columnIndex;
},
_findFirstMatchingElementNameFromEventPath: function (evt, nodeName) {
var el;
evt.path.some(function (node) {
if (node.nodeName === nodeName) {
el = node;
return true;
}
});
return el;
},
_dataChanged: function (changeRec) {
if (this.data === undefined || this.data === null || !this._isAttached && changeRec.base.length === 0) {
return;
}
if (!this._isAttached) {
var _this = this;
this.debounce(function () {
_this._dataChanged(changeRec);
}, 10);
return;
}
if (!this.meta || this.meta.length === 0) {
this._generateMetaFromData();
}
if (typeof this._internalData !== 'undefined' && this._internalData.length === 0) {
this._internalData = this._initializeInternalData();
} else {
this._internalData = this._refreshInternalData();
}
this._filterSortAndUpdateDisplayedTable();
var pathNumber = new RegExp('([#])([0-9])+');
if (pathNumber.test(changeRec.path)) {
var index = pathNumber.exec(changeRec.path)[0].slice(1);
var pathPieces = changeRec.path.split('.'), columnName = pathPieces[pathPieces.length - 1], column;
this.meta.some(function (columnEl) {
if (columnEl.name === columnName) {
column = columnEl;
return true;
}
});
if (this._cellChanged(this._readContent(this._internalData[index], column), changeRec.value)) {
this._handleValidateEvent(evt);
}
}
},
_selectableChanged: function (newSelectable) {
if (newSelectable === true && this.meta !== null && this.meta !== undefined && this.meta.length > 0) {
this.splice('meta', 0, 0, this._generateMetaForColumn('_selected', 'selected', true, 'Selected (0)'));
} else if (newSelectable === false && this.meta !== null && this.meta !== undefined && this.meta.length > 0 && this.meta[0].name === '_selected') {
this.shift('meta');
}
},
_generateMetaFromData: function () {
var meta = [];
for (var prop in this.data[0]) {
if (prop.indexOf('_') !== 0) {
var colInfo = this._generateLightDomColumn(prop, 'string', false, prop.charAt(0).toUpperCase() + prop.slice(1));
Polymer.dom(this).appendChild(colInfo);
}
}
return meta;
},
_generateLightDomColumn: function (prop, type, isSelectAll, label) {
return Polymer.Base.create('px-data-table-column', {
name: prop,
label: label,
type: type,
sortable: true,
filterable: true,
editable: false,
required: false,
selectAll: isSelectAll
});
},
_generateMetaForColumn: function (prop, type, isSelectAll, label) {
return Polymer.Base.create('px-data-table-column', {
name: prop,
label: label,
type: type,
sortable: true,
filterable: true,
editable: false,
required: false,
selectAll: isSelectAll,
validate: function () {
return { 'passedValidation': true };
}
});
},
_filterSortAndUpdateDisplayedTable: function () {
var i, index, count = 0, self = this, len;
this.filteredSortedData = this._internalData;
for (i = 0, len = this._internalData.length; i < len; i++) {
this._setInternalDataAt(this._internalData[i], '_filtered', false);
}
if (this.sortedColumn) {
this.filteredSortedData = this._sortByColumn(this.filteredSortedData);
}
for (index in this.filteredColumns) {
this.filteredSortedData = this._filterByColumn(this.filteredColumns[index].name, this.filteredColumns[index].userEntry, this.filteredSortedData);
}
self = this;
this._internalData.forEach(function (row) {
if (!self._getInternalCellStateAt(row, '_filtered')) {
count++;
}
});
this.set('numberOfItems', count);
this.$.pagination.goToPageNumber(1);
this._updateDisplayedRows();
},
_refreshInternalData: function (resetDataState) {
var _internalData = [], i, len;
for (i = 0, len = this.data.length; i < len; i++) {
var thisObj = this.data[i], cellDataObj = { dataIndex: i };
for (var key in thisObj) {
if (Object.prototype.hasOwnProperty.call(thisObj, key)) {
cellDataObj[key] = {};
cellDataObj[key].value = thisObj[key];
if (resetDataState) {
cellDataObj[key]._validation = { passedValidation: true };
} else {
cellDataObj[key]._validation = this._internalData[i].row[key]._validation;
}
}
}
_internalData.push({
row: cellDataObj,
_filtered: resetDataState ? false : this._internalData[i]._filtered,
_selected: resetDataState ? false : this._internalData[i]._selected,
_highlight: resetDataState ? {
value: false,
highlightColor: ''
} : this._internalData[i]._highlight
});
}
return _internalData;
},
_initializeInternalData: function () {
return this._refreshInternalData(true);
},
_setInternalDataAt: function (row, columnName, value) {
if (columnName === '_selected' || columnName === '_filtered' || columnName === '_highlight') {
this.set('displayedRows.' + this.displayedRows.indexOf(row) + '.' + columnName, value);
row[columnName] = value;
} else {
row.row[columnName].value = value;
}
},
_getInternalDataAt: function (row, columnName) {
return this._getInternalCellStateAt(row, columnName).value;
},
_getInternalCellValidationStateAt: function (row, columnName) {
return this._getInternalCellStateAt(row, columnName)._validation;
},
_setInternalCellValidationStateAt: function (row, columnName, value) {
row.row[columnName]._validation = value;
},
_getInternalCellStateAt: function (row, columnName) {
if (columnName === '_selected' || columnName === '_filtered') {
return row[columnName];
} else {
return row.row[columnName] ? row.row[columnName] : {};
}
},
_updateDisplayedRows: function () {
var fromPage, to;
if (this.firstItemIndex !== null && this.firstItemIndex !== undefined && this.pageSize !== null && this.pageSize !== undefined && this.filteredSortedData !== undefined && this.filteredSortedData !== null && !this.hidePaginationControl) {
fromPage = this.firstItemIndex - 1;
to = fromPage + this.pageSize;
this.set('displayedRows', this.filteredSortedData.slice(fromPage, to));
} else if (this.filteredSortedData !== undefined && this.filteredSortedData !== null && this.hidePaginationControl) {
this.set('displayedRows', this.filteredSortedData);
}
},
_sort: function (e, p) {
var column = e.model.column, sortingColumn;
if (column && column.sortable) {
sortingColumn = column.name;
if (sortingColumn === this.sortedColumn) {
this.set('descending', !this.descending);
} else {
this.set('sortedColumn', sortingColumn);
this.set('descending', false);
}
}
this._filterSortAndUpdateDisplayedTable();
},
_sortByColumn: function (rowsToSort) {
var sortFunction = this._getSortFunction(), sortedRows;
sortedRows = rowsToSort.map(function (e, i) {
var v;
if (this.sortedColumn === '_selected') {
v = this._getInternalCellStateAt(e, this.sortedColumn);
} else {
v = this._getInternalDataAt(e, this.sortedColumn);
}
if (undefined === v || null === v) {
v = '';
}
return {
index: i,
value: typeof v === 'string' ? v.toLowerCase() : v
};
}, this).sort(sortFunction.bind(this)).map(function (e) {
return rowsToSort[e.index];
});
return sortedRows;
},
_getSortFunction: function () {
var sortFunction;
if (this.sortedColumn !== '_selected') {
this.meta.forEach(function (obj) {
if (this.sortedColumn === obj.name) {
sortFunction = this._resolveFunctionOnWindow('sort-function-name', obj);
}
}, this);
}
if (!sortFunction) {
if (this.sortedColumn === '_selected') {
sortFunction = this._defaultSortSelected;
} else {
sortFunction = this._defaultSortAlphabetically;
}
}
return sortFunction;
},
_resolveFunctionOnWindow: function (columnAttributeName, columnObj) {
var customFunction = window, customFunctionFullPath, i, customFunctionRef = columnObj[columnAttributeName];
if (customFunctionRef === null || customFunctionRef === undefined) {
if (columnObj instanceof HTMLElement) {
customFunctionRef = columnObj.attributes[columnAttributeName];
}
if (customFunctionRef === null || customFunctionRef === undefined) {
return null;
}
}
customFunctionFullPath = customFunctionRef.value.split('.');
for (i in customFunctionFullPath) {
customFunction = customFunction[customFunctionFullPath[i]];
if (customFunction === undefined) {
console.warn('px-data-table: Custom function was used, but was not found on window. Is the path correct?');
return null;
}
}
return customFunction;
},
_defaultSortAlphabetically: function (a, b) {
if (this.descending) {
if (a.value < b.value) {
return 1;
}
return -1;
} else {
if (a.value > b.value) {
return 1;
}
return -1;
}
},
_defaultSortSelected: function (a, b) {
if (this.descending) {
if (a.value && !b.value) {
return 1;
} else if (!a.value && b.value) {
return -1;
}
return 0;
} else {
if (a.value && !b.value) {
return -1;
} else if (!a.value && b.value) {
return 1;
}
return 0;
}
},
_filter: function (e) {
var column = this.$.filterRepeat.modelForElement(e.target).column, userEntry, isNotInFilteredColumnsList, index, filteredColumn;
if (column && column.filterable) {
userEntry = e.target.value;
isNotInFilteredColumnsList = true;
for (index in this.filteredColumns) {
filteredColumn = this.filteredColumns[index];
if (filteredColumn.name === column.name) {
isNotInFilteredColumnsList = false;
if (userEntry === '' || userEntry === undefined || userEntry === null) {
this.filteredColumns.splice(index, 1);
} else {
filteredColumn.userEntry = userEntry;
}
}
}
if (isNotInFilteredColumnsList) {
this.filteredColumns.push({
'name': column.name,
'userEntry': userEntry
});
}
this._filterSortAndUpdateDisplayedTable();
}
},
_filterByColumn: function (columnName, userEntry, rowsToFilter) {
var filterFunction = this._getFilterFunction(columnName), i, len, matched, self = this, filteredRows;
for (i = 0, len = rowsToFilter.length; i < len; i++) {
if (rowsToFilter[i]._filtered === false) {
matched = filterFunction(userEntry, this._getInternalDataAt(rowsToFilter[i], columnName));
if (!matched) {
this._setInternalDataAt(rowsToFilter[i], '_filtered', true);
}
}
}
this.filtered = rowsToFilter.some(function (row) {
return self._getInternalCellStateAt(row, '_filtered');
});
filteredRows = rowsToFilter.filter(function (r) {
return !self._getInternalCellStateAt(r, '_filtered');
});
return filteredRows;
},
_getFilterFunction: function (columnName) {
var filterFunction;
this.meta.forEach(function (obj) {
if (columnName === obj.name) {
filterFunction = this._resolveFunctionOnWindow('filter-function-name', obj);
}
}, this);
if (!filterFunction) {
filterFunction = this._defaultFilter;
}
return filterFunction;
},
_defaultFilter: function (searchString, cellValue) {
if (searchString === undefined || searchString === null || searchString === '') {
return true;
}
return cellValue.toString().toLowerCase().indexOf(searchString.toString().toLowerCase()) > -1;
},
_save: function (evt) {
var row = evt.model.internalRow, column = evt.model.column, newValue = evt.detail.newValue;
if (row) {
this.fire('before-save', {
'event': evt,
'row': row,
'column': column
});
this._setInternalDataAt(row, column.name, newValue);
evt.currentTarget.cellValue = this._getInternalDataAt(row, column.name);
evt.currentTarget.cellDisplayValue = this._readContent(row, column);
this.data[row.row.dataIndex][column.name] = newValue;
this.notifyPath('data.' + row.row.dataIndex + '.' + column.name, newValue);
}
if (column.required && !evt.target.validity.valid) {
this.fire('after-invalid', {
'event': evt,
'row': row,
'column': column
});
}
this.fire('after-save', {
'event': evt,
'row': row,
'column': column
});
},
_cellChanged: function (oldValue, newValue) {
return oldValue !== newValue;
},
_handleValidateEvent: function (evt) {
var column = evt.model.column, validationObj = column.validate(evt.detail.newValue);
evt.currentTarget.cellValidation = validationObj;
this._setInternalCellValidationStateAt(evt.model.internalRow, column.name, validationObj);
},
_clickRow: function (evt) {
var column = evt.model.column, row = evt.model.internalRow, detail = {
'row': row,
'column': column
}, selectAllCheckbox;
this.fire('px-row-click', detail);
if (this.selectable) {
this._selectRow(row, this.$.recordList.indexForElement(evt.currentTarget));
selectAllCheckbox = Polymer.dom(this.root).querySelector('#selectAllCheckbox');
selectAllCheckbox.checked = false;
if (this.sortedColumn === '_selected') {
this.set('sortedColumn', '');
}
}
},
_clickCell: function (evt) {
var column = evt.model.column, row = evt.model.internalRow, detail = {
'row': row,
'column': column,
'rowIndex': this.$.recordList.indexForElement(evt.currentTarget)
};
this.fire('px-cell-click', detail);
},
_clickSelectAll: function (e) {
if (e.target.checked) {
this._setAllRows(true);
} else {
this._setAllRows(false);
}
},
_setAllRows: function (isSelected) {
var i, len;
for (i = 0, len = this._internalData.length; i < len; i++) {
this._setInternalDataAt(this._internalData[i], '_selected', isSelected);
}
for (i = 0, len = this.displayedRows.length; i < len; i++) {
this.notifyPath('displayedRows.' + i + '._selected', this.displayedRows[i]._selected);
}
this.splice('selectedRows', 0, this.selectedRows.length);
if (isSelected) {
for (i = 0, len = this._internalData.length; i < len; i++) {
this.push('selectedRows', this._internalData[i]);
}
}
this.set('meta.0.label', 'Selected (' + this.selectedRows.length + ')');
this.fire('px-select-all-click', this.selectedRows);
},
_selectRow: function (row, indexInDisplayedRows) {
this.fire('before-select', row);
if (this.selectedRows.indexOf(row) > -1) {
row._selected = false;
this.notifyPath('displayedRows.' + indexInDisplayedRows + '._selected', row._selected);
this.splice('selectedRows', this.selectedRows.indexOf(row), 1);
} else {
row._selected = true;
this.notifyPath('displayedRows.' + indexInDisplayedRows + '._selected', row._selected);
this.push('selectedRows', row);
}
this.set('meta.0.label', 'Selected (' + this.selectedRows.length + ')');
this.fire('after-select', row);
},
_dragDropColumnHeader: function (evt) {
if (this.enableColumnReorder) {
this._dropColumnHeader(this._findHeaderFromChild(evt.target));
}
},
_touchDropColumnHeader: function (evt) {
if (this.enableColumnReorder) {
this._removeDragFromSourceHeader();
var target = document.elementFromPoint(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
target = this._findHeaderFromChild(target);
this._dropColumnHeader(target);
}
},
_dropColumnHeader: function (target) {
var srcName = this._columnDragged, toMove, regex, targetName, targetColumn, columns, parent;
regex = target.classList.toString().match(/.*aha-(.*)-th/);
targetName = regex && regex.length > 1 ? regex[1] : null;
if (targetName != null) {
if (targetName !== srcName) {
columns = this.getEffectiveChildren();
columns.forEach(function (column) {
if (column.name === srcName) {
toMove = column;
}
if (column.name === targetName) {
targetColumn = column;
}
});
if (toMove && targetName !== '_selected' || toMove !== columns[0]) {
parent = Polymer.dom(toMove).parentNode;
Polymer.dom(parent).removeChild(toMove);
Polymer.dom.flush();
if (targetName === '_selected') {
Polymer.dom(parent).insertBefore(toMove, columns[0]);
} else {
Polymer.dom(parent).insertBefore(toMove, targetColumn.nextSibling);
}
}
} else {
target.classList.remove('dragged');
}
}
this._removeInsertionDisplay();
},
_dragOverHeader: function (evt) {
if (this.enableColumnReorder) {
var target = this._findHeaderFromChild(evt.target);
if (!target.classList.contains('aha-insertion-indicator-th')) {
evt.preventDefault();
this._allowColumnDrop(target, this._requestInsertionIndicatorRemoval && this._displayingInsertion);
}
}
},
_touchMoveHeader: function (evt) {
if (this.enableColumnReorder) {
var target = document.elementFromPoint(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
target = this._findHeaderFromChild(target);
if (!target.classList.contains('aha-insertion-indicator-th')) {
this._allowColumnDrop(target, target !== this._findHeaderFromChild(evt.target));
}
}
},
_allowColumnDrop: function (target, moveIndicator) {
if (moveIndicator) {
this.set('_requestInsertionIndicatorRemoval', false);
var targetIdx, indicatorIdx, regex = target.classList.toString().match(/.*aha-(.*)-th/), targetName = regex && regex.length > 1 ? regex[1] : null;
if (targetName != null) {
this.meta.forEach(function (column, index) {
if (column.name === targetName) {
targetIdx = index;
} else if (column.name === 'insertion-indicator') {
indicatorIdx = index;
}
});
if (targetIdx !== undefined && targetIdx + 1 !== indicatorIdx) {
var indicator = this.splice('meta', indicatorIdx, 1)[0];
if (targetIdx + 1 > indicatorIdx) {
targetIdx--;
}
this.splice('meta', targetIdx + 1, 0, indicator);
}
}
} else if (!this._displayingInsertion) {
var regex = target.classList.toString().match(/.*aha-(.*)-th/), targetName = regex && regex.length > 1 ? regex[1] : null;
if (targetName !== null) {
var targetIdx;
this.meta.forEach(function (column, index) {
if (column.name === targetName) {
targetIdx = index;
}
});
var insertCol = this._generateMetaForColumn('insertion-indicator', 'string', false, '');
insertCol.filterable = false;
insertCol.sortable = false;
this.splice('meta', targetIdx + 1, 0, insertCol);
this.set('_displayingInsertion', true);
}
}
},
_dragLeave: function (evt) {
this._removeInsertionDisplay();
},
_dragEndColumnHeader: function (evt) {
this._removeDragFromSourceHeader();
},
_removeInsertionDisplay: function () {
var _this = this;
this.set('_requestInsertionIndicatorRemoval', true);
window.setTimeout(function () {
if (_this.enableColumnReorder && _this._displayingInsertion && _this._requestInsertionIndicatorRemoval) {
var insertionColIdx;
_this.meta.forEach(function (column, index) {
if (column.name === 'insertion-indicator') {
insertionColIdx = index;
}
});
_this.splice('meta', insertionColIdx, 1);
_this.set('_displayingInsertion', false);
this._columnDragged = '';
}
}, 100);
},
_dragStartColumnHeader: function (evt) {
var target = this._findHeaderFromChild(evt.target);
if (this.enableColumnReorder && target.classList.contains('moveable')) {
var name = target.classList.toString().match(/.*aha-(.*)-th/)[1];
this._columnDragged = name;
target.classList.add('dragged');
if (evt.changedTouches) {
evt.preventDefault();
this._allowColumnDrop(target, false);
}
} else {
evt.preventDefault();
}
},
_removeDragFromSourceHeader: function () {
var src = Polymer.dom(this.root).querySelector('.dragged');
if (src) {
src.classList.remove('dragged');
}
},
_columnChooserChanged: function (dropdownItem) {
if (dropdownItem.path.indexOf('checked') !== -1) {
var index = dropdownItem.path.match(/\.#(\d+)./)[1];
if (index) {
var columnName = dropdownItem.base[index].name, checked = dropdownItem.value;
if (checked) {
this.showColumn(columnName);
} else {
this.hideColumn(columnName);
}
}
}
},
_computeColumnChooserItems: function (meta) {
var items = [];
meta.forEach(function (column, index) {
if (column.name !== '_selected' && column.name !== 'insertion-indicator') {
items.push({
name: column.name,
val: column.label,
checked: !column.hide
});
}
});
return items;
},
hideColumn: function (columnName) {
this.meta.forEach(function (column, index) {
if (column.name === columnName) {
column.hide = true;
this.notifyPath('meta.' + index + '.hide', true);
}
}, this);
},
showColumn: function (columnName) {
this.meta.forEach(function (column, index) {
if (column.name === columnName) {
column.hide = false;
this.notifyPath('meta.' + index + '.hide', false);
}
}, this);
},
_headerTrack: function (evt) {
var target = this._findHeaderFromChild(evt.target);
if (target !== this) {
target.style.width = this._headerInitialSize + evt.detail.dx + 'px';
}
},
_headerResizeMouseDown: function (evt) {
var target = this._findHeaderFromChild(evt.target), currentSize;
if (target !== this) {
currentSize = target.getBoundingClientRect();
this._headerInitialSize = currentSize.width;
evt.preventDefault();
evt.stopPropagation();
}
},
_getRowClass: function (row) {
return [
'tr',
'rows',
this.striped ? 'striped' : ''
].join(' ');
},
_getHighlightValue: function (row, column, high) {
var highlightElements = Polymer.dom(column).querySelectorAll('px-data-table-highlight'), doHighlight = false, highlightObj = { value: false }, highlightClass;
highlightElements.forEach(function (highlightEl) {
doHighlight = highlightEl.highlight(this._getInternalDataAt(row, column.name));
if (highlightObj.value && doHighlight) {
if (highlightObj.highlightValue === 'low') {
highlightObj.highlightClass = 'cell--value__highlight--color__' + highlightEl.highlightValue;
} else if (highlightObj.highlightValue === 'medium') {
if (highlightEl.highlightValue === 'high') {
highlightObj.highlightClass = 'cell--value__highlight--color__' + highlightEl.highlightValue;
}
} else {
highlightObj.highlightClass = 'cell--value__highlight--color__' + highlightEl.highlightValue;
}
} else if (!highlightObj.value) {
highlightObj.value = doHighlight;
highlightObj.highlightClass = 'cell--value__highlight--color__' + highlightEl.highlightValue;
}
if (highlightEl.highlightType === 'row') {
this._setInternalDataAt(row, '_highlight', highlightObj);
highlightObj = { value: false };
}
}.bind(this));
return highlightObj;
},
_isSelectAllColumn: function (column) {
return column.selectAll;
},
_isFilterableColumn: function (column, filterable) {
return !column.selectAll && column.filterable && !column.hide;
},
_readContent: function (row, column) {
var datum = this._getInternalDataAt(row, column.name);
if (datum === null || datum === undefined || typeof datum === 'string' && datum.trim().length === 0) {
return '';
}
if (this._shouldClipDatumString(row, column)) {
return this._clipDatumString(datum, column);
}
return datum;
},
_shouldClipDatumString: function (row, column) {
var datum = this._getInternalDataAt(row, column.name), maxColWidth = column.maxColumnCharacterWidth;
if (maxColWidth === 0 || datum === null || datum === undefined || typeof datum === 'string' && datum.trim().length === 0) {
return false;
}
if (maxColWidth !== undefined && maxColWidth !== null) {
return datum.length > maxColWidth;
}
return false;
},
_clipDatumString: function (datum, column) {
var maxColWidth = column.maxColumnCharacterWidth, ellipsisClipPosition = column.ellipsisClipPosition, datumLeftIndex, datumRightIndex;
if (ellipsisClipPosition === 'left') {
datum = '\u2026' + datum.substr(datum.length - maxColWidth, datum.length);
} else if (ellipsisClipPosition === 'center') {
datumLeftIndex = Math.floor(maxColWidth / 2);
datumRightIndex = maxColWidth - datumLeftIndex;
datum = datum.substr(0, datumLeftIndex) + '\u2026' + datum.substr(datum.length - datumRightIndex, datum.length);
} else {
datum = datum.substr(0, maxColWidth) + '\u2026';
}
return datum;
},
_isEqual: function (source, target) {
return source === target;
},
_isFalse: function (source) {
return source === false || source === 'false';
},
_getHeaderClass: function (item) {
var classList = [
'th ',
'aha-' + item.name + '-th',
'u-p0'
];
if (item.sortable) {
classList.push('sortable');
}
if (!this.tableRows && !this.tableColumns) {
classList.push('th--no-borders');
}
if (this.enableColumnReorder && item.type !== 'selected') {
classList.push('moveable');
}
return classList.join(' ');
},
_getSecondHeaderClass: function (filterable) {
var classList = [
'tr',
'tr--filter'
];
if (!filterable) {
classList.push('hidden');
}
return classList.join(' ');
},
_getFilterHeaderClass: function (column) {
return column.name === 'insertion-indicator' ? 'td insertion-indicator' : 'td';
},
_getSortingIcon: function (column, sortingColumn, descending) {
var sortingIcon = ' ';
if (sortingColumn === column.name) {
sortingIcon = descending ? 'polymer-font-awesome:fa-caret-down' : 'polymer-font-awesome:fa-caret-up';
}
return sortingIcon;
},
_getSortingClass: function (column, sortingColumn, descending) {
var classList = 'sorting fa';
if (sortingColumn !== column.name) {
classList = classList + ' visuallyhidden';
}
return classList;
},
_getTextSortingClass: function (column, sortingColumn) {
var classList = [
'column-head',
'u-m--'
];
if (column.sortable) {
classList.push('sorted-text-hover');
}
if (sortingColumn === column.name) {
classList.push('sorted-text');
}
return classList.join(' ');
},
_getTableClass: function (tableRows, tableColumns) {
var classList = [
'table',
'table--small'
];
if (tableRows) {
classList.push('table--rows');
}
if (tableColumns) {
classList.push('table--columns');
}
return classList.join(' ');
},
_getPaginationVisibility: function (hidePaginationControl) {
return hidePaginationControl ? 'visuallyhidden' : '';
},
_getSelectedCellClass: function (selected, rowHighlighted) {
var classList = ['td'];
classList.push(selected ? 'selected-cell__selected' : '');
classList.push(rowHighlighted.value ? rowHighlighted.highlightClass : '');
return classList.join(' ');
},
_findHeaderFromChild: function (childElem) {
var header = childElem;
while (!header.classList.contains('th') && header !== this) {
header = Polymer.dom(header).parentNode;
}
return header;
},
_computeIfColumnFilterEnabled: function (meta, filterable) {
this._enableFilterRow = meta && (this.selectable === true || filterable && this.meta.some(function (val) {
return this._isFilterableColumn(val);
}.bind(this)));
}
});
Polymer({
is: 'px-data-table-column',
properties: {
name: {
type: String,
value: ''
},
label: {
type: String,
value: ''
},
type: {
type: String,
value: 'string'
},
sortable: {
type: Boolean,
value: false
},
editable: {
type: Boolean,
value: false
},
filterable: {
type: Boolean,
value: false,
notify: true
},
sortFunctionName: {
type: String,
value: ''
},
filterFunctionName: {
type: String,
value: ''
},
maxColumnCharacterWidth: {
type: Number,
value: 0
},
ellipsisClipPosition: {
type: String,
value: 'right'
},
dropdownItems: {
type: Array,
value: function () {
return [];
},
notify: true
},
hide: {
type: Boolean,
value: false
},
_highLightElLoadedCount: {
type: Number,
value: 0
}
},
validate: function (value) {
var validationEl = Polymer.dom(this).querySelector('px-validation');
if (validationEl) {
return validationEl.validate(value);
} else {
return { passedValidation: true };
}
}
});
Polymer({
is: 'px-data-table-highlight',
properties: {
import: {
type: String,
value: ''
},
highlight: {
type: Object,
value: function () {
return new Function();
}
},
highlightMethod: {
type: String,
value: ''
},
highlightColor: {
type: String,
value: ''
},
highlightType: {
type: String,
value: 'cell'
},
highlightValue: {
type: String,
value: 'low'
}
},
ready: function () {
this.importHref(this.import, function (e) {
if (this.highlightMethod && window.PxHighlight[this.highlightMethod]) {
this.highlight = window.PxHighlight[this.highlightMethod];
this.fire('px-data-table-highlight-loaded');
}
}, function (e) {
}, false);
},
calculateHighlightColor: function () {
var highlightColorValue;
this.updateStyles();
if (this.highlightColor) {
highlightColorValue = this.highlightColor;
} else {
var cssVarName = '--cell--value__highlight--' + this.highlightValue + '--color';
highlightColorValue = this.getComputedStyleValue(cssVarName);
}
return highlightColorValue;
}
});
Polymer({
is: 'px-validator',
properties: {
import: {
type: String,
value: ''
},
validators: {
type: Array,
value: function () {
return [];
}
},
multiStepValidation: {
type: Array,
value: function () {
return [];
}
},
validationMethod: {
type: String,
value: ''
}
},
ready: function () {
this.importHref(this.import, function (e) {
if (this.validationMethod && window.PxValidators[this.validationMethod]) {
this.validators.push(window.PxValidators[this.validationMethod]);
}
this.validators.concat(this.validators, this.multiStepValidation.map(function (funcName) {
return window.PxValidators[funcName];
}.bind(this)));
}, function (e) {
console.error('Error, could not load ' + this.import);
});
}
});
Polymer({
is: 'px-validation',
validate: function (value) {
var result = { passedValidation: true };
var validationResult;
Polymer.dom(this).querySelectorAll('px-validator').forEach(function (validatorEl) {
validatorEl.validators.every(function (validatorMethod) {
validationResult = validatorMethod(value);
if (!validationResult.passedValidation) {
result = validationResult;
return false;
}
});
});
return result;
}
});
Polymer({
is: 'px-data-table',
properties: {
tableData: {
type: Array,
value: function () {
return [];
},
notify: true
},
striped: {
type: Boolean,
value: false
},
filterable: {
type: Boolean,
value: false
},
tableColumns: {
type: Boolean,
value: false
},
tableRows: {
type: Boolean,
value: false
},
selectable: {
type: Boolean,
value: false
},
hidePaginationControl: {
type: Boolean,
value: false
},
selectedRows: {
type: Array,
value: function () {
return [];
},
notify: true
},
showColumnChooser: {
type: Boolean,
value: false
},
enableColumnReorder: {
type: Boolean,
value: false
},
enableColumnResize: {
type: Boolean,
value: false
}
}
});
'use strict';
!function () {
function a(a) {
if (a && a.length >= 2)
return {
x: a[0],
y: a[1]
};
throw new Error('Invalid time series point format');
}
function b(b) {
if (b.name && b.values && b.values.constructor === Array) {
var c = b.values, d = c.map(a);
return {
name: b.name,
data: d
};
}
throw new Error('Invalid time series data format');
}
function c(a) {
if (a && a.constructor === Array) {
var c = [];
return a.forEach(function (a) {
if (!a.results || a.results.constructor !== Array)
throw new Error('Invalid time series data format');
c = c.concat(a.results.map(b));
}), c;
}
throw new Error('Invalid time series data format');
}
window.px = window.px || {}, window.px.timeseries = window.px.timeseries || {}, window.px.timeseries.adapter = window.px.timeseries.adapter || {}, window.px.timeseries.adapter.kairosdb = window.px.timeseries.adapter.kairosdb || {}, window.px.timeseries.adapter.kairosdb = { transform: c }, window.px.timeseries.dataTransformer = function (a) {
this.option = {
getSeriesName: function (a, b) {
var c = '';
return b && b.constructor === Array && b.forEach(function (a) {
c = c + '_' + a.name, a.values && a.values.constructor === Array && a.values.forEach(function (a) {
c = c + '_' + a;
});
}), a + c;
}
}, a && a.getSeriesName && 'function' == typeof a.getSeriesName && (this.option.getSeriesName = a.getSeriesName);
}, window.px.timeseries.dataTransformer.prototype.transform = function (a) {
if (a && a.constructor === Array) {
var b = [], c = this;
return a.forEach(function (a) {
if (!a.name || !a.results || a.results.constructor !== Array)
throw new Error('Invalid time series data format');
a.results.map(c.makeSeries).forEach(function (d) {
d.name = c.option.getSeriesName(a.name, d._groups), delete d._groups, b = b.concat(d);
});
}), b;
}
throw new Error('Invalid time series data format');
}, window.px.timeseries.dataTransformer.prototype.makeSeries = function (b) {
if (b.datapoints && b.datapoints.constructor === Array) {
var c = b.datapoints.map(a);
return {
_groups: b.groups,
data: c
};
}
throw new Error('Invalid time series data format');
}, window.addEventListener('px-deck-ready', function (a) {
a.target.init();
}), window.px.dealer = {
setHttpProvider: function (a) {
this.httpProvider = a;
},
getHttpProvider: function () {
var a = null;
return this.httpProvider ? this.httpProvider : (window.angular && (a = angular.element('body').injector().get('$http')), a);
},
getData: function (a, b) {
return null !== b && 'object' == typeof b || (b = {}), /callback=/.test(a) ? b.method = 'JSONP' : b.method = 'GET', b.url = a, this.httpRequest(b);
},
httpRequest: function (a) {
var b = this.getHttpProvider();
return b ? new Promise(function (c, d) {
var e = function (a) {
c(a);
}, f = function (a) {
d(a);
};
b(a).success(e).error(f);
}) : void 0;
},
init: function (a, b) {
this.deckDefinitions = a, this.decksByClassification = b;
},
getDecksByClassification: function (a, b) {
var c = [], d = this;
if (a && this.decksByClassification && a in this.decksByClassification) {
var e = this.decksByClassification[a];
b in e && e[b].forEach(function (a) {
d.deckDefinitions[a] && c.push(d.deckDefinitions[a]);
});
}
return new Promise(function (a, b) {
a(c);
});
},
getDeck: function (a) {
return this.getData(a);
}
}, window.px.isInt = function (a) {
return Number(a) === a && a % 1 === 0;
}, window.px.isFloat = function (a) {
return a === Number(a) && a % 1 !== 0;
}, window.px.isArray = function (a) {
return '[object Array]' === Object.prototype.toString.call(a);
}, window.px.isNumber = function (a) {
return !a && 0 !== a || 'true' === a.toString() ? !1 : +a === +a;
}, window.px.slugify = function (a) {
var b = a.replace(/([a-z])([A-Z])/g, '$1 $2'), c = b.toLowerCase(), d = c.replace(/\s/g, '-');
return d;
};
}();
var pxSimpleChartCommonBehavior = {
defaultWidth: '283',
defaultHeight: '150',
minimumWidth: '100',
minimumHeight: '50',
properties: {
width: {
type: String,
observer: '_drawChart',
value: this.defaultWidth
},
height: {
type: String,
observer: '_drawChart',
value: this.defaultHeight
}
},
attached: function () {
this.svg = d3.select(this.$$('svg'));
this._drawChart();
},
_drawChart: function () {
if (this.svg) {
this._removeChart();
this.debounce('_drawChartDebounced', function () {
this._drawChartDebounced();
}, 310);
}
},
_removeChart: function () {
this.debounce('_removeChartDebounced', function () {
this._removeChartDebounced();
}, 300);
},
_removeChartDebounced: function () {
this.svg.attr('width', 1).attr('height', 1).text('');
},
_addStyleScope: function () {
if (this.svg[0] && this.svg[0][0]) {
d3.selectAll(this.svg[0][0].childNodes).classed(this.is, true);
}
;
},
_addStyleScopeToElement: function (el) {
el.classed(this.is, true);
},
_clearSVG: function () {
this.svg.attr('width', 1).attr('height', 1).text('');
},
_getSeriesTotal: function (series) {
return series.reduce(function (p, c) {
return p + c;
});
},
_getLongestSeries: function (seriesArray) {
try {
return seriesArray.reduce(function (prev, current) {
return prev.length < current.length ? current : prev;
});
} catch (err) {
console.log('_getLongestSeries error:', err);
return 0;
}
;
},
_calculateTextSize: function (text, className) {
var that = this;
return new Promise(function (resolve, reject) {
var textNode = that.svg.append('text').attr('class', className).attr('x', 0).attr('y', 0).text(text);
that._addStyleScopeToElement(textNode);
var textSizeTimeout = setTimeout(function () {
var rectObject = textNode.node().getBBox();
resolve(rectObject);
textNode.remove();
}, 10);
});
},
_calculateTextHeight: function (text, className) {
var that = this;
return new Promise(function (resolve, reject) {
var textSizePromise = that._calculateTextSize(text, className);
textSizePromise.then(function (rectObject) {
resolve(Math.round(rectObject.height));
}).catch(function (reason) {
console.log('textSizePromise rejected: ', reason);
});
});
},
_calculateTextWidth: function (text, className) {
var that = this;
return new Promise(function (resolve, reject) {
var textSizePromise = that._calculateTextSize(text, className);
textSizePromise.then(function (rectObject) {
resolve(Math.round(rectObject.width));
}).catch(function (reason) {
console.log('textSizePromise rejected: ', reason);
});
});
},
_reconcileValue: function (value, defaultValue) {
switch (value) {
case '':
case false:
case undefined:
return defaultValue;
break;
case 'false':
return false;
break;
case 'auto':
return 'auto';
break;
default:
if (px.isFloat(Number(value))) {
return parseFloat(value);
} else if (px.isInt(Number(value))) {
return parseInt(value);
} else {
return value;
}
;
break;
}
;
},
_ensureMinimum: function (value, min) {
return value = value >= min ? value : min;
},
_reconcileWidth: function (value) {
var width = this._reconcileDimensionValue(value, this.defaultWidth, 'width');
if (width < this.minimumWidth) {
width = this.defaultWidth;
console.error('The width of the chart with id of "' + this.id + '" is too low. The minimum is ' + this.minimumWidth + ' pixels, however the chart is set to ' + width + '. The default value of ' + this.defaultWidth + ' has been assigned to the chart.');
}
;
return width;
},
_reconcileHeight: function (value) {
var height = this._reconcileDimensionValue(value, this.defaultHeight, 'height');
if (height < this.minimumHeight) {
height = this.defaultHeight;
console.error('The height of the chart with id of "' + this.id + '" is too low. The minimum is ' + this.minimumHeight + ' pixels, however the chart is set to ' + height + '. The default value of ' + this.defaultHeight + ' has been assigned to the chart.');
}
;
return height;
},
_reconcileDimensionValue: function (value, defaultValue, type) {
var value = this._reconcileValue(value, defaultValue);
return value === 'auto' ? this._getAutoValue(type) : parseInt(value);
},
_getAutoValue: function (type) {
var parent = this.parentNode;
var padding = this._getElementPadding(parent);
if (type === 'width') {
return parseInt(parent.clientWidth - padding.left - padding.right);
} else if (type === 'height') {
return parseInt(parent.clientHeight - padding.top - padding.bottom);
}
},
_getElementPadding: function (el) {
var style = window.getComputedStyle(el, null);
return {
top: style.getPropertyValue('padding-top').split('px')[0],
right: style.getPropertyValue('padding-right').split('px')[0],
bottom: style.getPropertyValue('padding-bottom').split('px')[0],
left: style.getPropertyValue('padding-left').split('px')[0]
};
},
_setDimensions: function () {
this.widthValue = this._reconcileWidth(this.width);
this.heightValue = this._reconcileHeight(this.height);
if (this.height === 'auto' || this.width === 'auto') {
var that = this;
window.addEventListener('resize', function () {
that._drawChart();
});
}
;
}
};
(function () {
'use strict';
function lib$es6$promise$utils$$objectOrFunction(x) {
return typeof x === 'function' || typeof x === 'object' && x !== null;
}
function lib$es6$promise$utils$$isFunction(x) {
return typeof x === 'function';
}
function lib$es6$promise$utils$$isMaybeThenable(x) {
return typeof x === 'object' && x !== null;
}
var lib$es6$promise$utils$$_isArray;
if (!Array.isArray) {
lib$es6$promise$utils$$_isArray = function (x) {
return Object.prototype.toString.call(x) === '[object Array]';
};
} else {
lib$es6$promise$utils$$_isArray = Array.isArray;
}
var lib$es6$promise$utils$$isArray = lib$es6$promise$utils$$_isArray;
var lib$es6$promise$asap$$len = 0;
var lib$es6$promise$asap$$toString = {}.toString;
var lib$es6$promise$asap$$vertxNext;
var lib$es6$promise$asap$$customSchedulerFn;
var lib$es6$promise$asap$$asap = function asap(callback, arg) {
lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len] = callback;
lib$es6$promise$asap$$queue[lib$es6$promise$asap$$len + 1] = arg;
lib$es6$promise$asap$$len += 2;
if (lib$es6$promise$asap$$len === 2) {
if (lib$es6$promise$asap$$customSchedulerFn) {
lib$es6$promise$asap$$customSchedulerFn(lib$es6$promise$asap$$flush);
} else {
lib$es6$promise$asap$$scheduleFlush();
}
}
};
function lib$es6$promise$asap$$setScheduler(scheduleFn) {
lib$es6$promise$asap$$customSchedulerFn = scheduleFn;
}
function lib$es6$promise$asap$$setAsap(asapFn) {
lib$es6$promise$asap$$asap = asapFn;
}
var lib$es6$promise$asap$$browserWindow = typeof window !== 'undefined' ? window : undefined;
var lib$es6$promise$asap$$browserGlobal = lib$es6$promise$asap$$browserWindow || {};
var lib$es6$promise$asap$$BrowserMutationObserver = lib$es6$promise$asap$$browserGlobal.MutationObserver || lib$es6$promise$asap$$browserGlobal.WebKitMutationObserver;
var lib$es6$promise$asap$$isNode = typeof process !== 'undefined' && {}.toString.call(process) === '[object process]';
var lib$es6$promise$asap$$isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';
function lib$es6$promise$asap$$useNextTick() {
return function () {
process.nextTick(lib$es6$promise$asap$$flush);
};
}
function lib$es6$promise$asap$$useVertxTimer() {
return function () {
lib$es6$promise$asap$$vertxNext(lib$es6$promise$asap$$flush);
};
}
function lib$es6$promise$asap$$useMutationObserver() {
var iterations = 0;
var observer = new lib$es6$promise$asap$$BrowserMutationObserver(lib$es6$promise$asap$$flush);
var node = document.createTextNode('');
observer.observe(node, { characterData: true });
return function () {
node.data = iterations = ++iterations % 2;
};
}
function lib$es6$promise$asap$$useMessageChannel() {
var channel = new MessageChannel();
channel.port1.onmessage = lib$es6$promise$asap$$flush;
return function () {
channel.port2.postMessage(0);
};
}
function lib$es6$promise$asap$$useSetTimeout() {
return function () {
setTimeout(lib$es6$promise$asap$$flush, 1);
};
}
var lib$es6$promise$asap$$queue = new Array(1000);
function lib$es6$promise$asap$$flush() {
for (var i = 0; i < lib$es6$promise$asap$$len; i += 2) {
var callback = lib$es6$promise$asap$$queue[i];
var arg = lib$es6$promise$asap$$queue[i + 1];
callback(arg);
lib$es6$promise$asap$$queue[i] = undefined;
lib$es6$promise$asap$$queue[i + 1] = undefined;
}
lib$es6$promise$asap$$len = 0;
}
function lib$es6$promise$asap$$attemptVertx() {
try {
var r = require;
var vertx = r('vertx');
lib$es6$promise$asap$$vertxNext = vertx.runOnLoop || vertx.runOnContext;
return lib$es6$promise$asap$$useVertxTimer();
} catch (e) {
return lib$es6$promise$asap$$useSetTimeout();
}
}
var lib$es6$promise$asap$$scheduleFlush;
if (lib$es6$promise$asap$$isNode) {
lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useNextTick();
} else if (lib$es6$promise$asap$$BrowserMutationObserver) {
lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMutationObserver();
} else if (lib$es6$promise$asap$$isWorker) {
lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useMessageChannel();
} else if (lib$es6$promise$asap$$browserWindow === undefined && typeof require === 'function') {
lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$attemptVertx();
} else {
lib$es6$promise$asap$$scheduleFlush = lib$es6$promise$asap$$useSetTimeout();
}
function lib$es6$promise$$internal$$noop() {
}
var lib$es6$promise$$internal$$PENDING = void 0;
var lib$es6$promise$$internal$$FULFILLED = 1;
var lib$es6$promise$$internal$$REJECTED = 2;
var lib$es6$promise$$internal$$GET_THEN_ERROR = new lib$es6$promise$$internal$$ErrorObject();
function lib$es6$promise$$internal$$selfFulfillment() {
return new TypeError('You cannot resolve a promise with itself');
}
function lib$es6$promise$$internal$$cannotReturnOwn() {
return new TypeError('A promises callback cannot return that same promise.');
}
function lib$es6$promise$$internal$$getThen(promise) {
try {
return promise.then;
} catch (error) {
lib$es6$promise$$internal$$GET_THEN_ERROR.error = error;
return lib$es6$promise$$internal$$GET_THEN_ERROR;
}
}
function lib$es6$promise$$internal$$tryThen(then, value, fulfillmentHandler, rejectionHandler) {
try {
then.call(value, fulfillmentHandler, rejectionHandler);
} catch (e) {
return e;
}
}
function lib$es6$promise$$internal$$handleForeignThenable(promise, thenable, then) {
lib$es6$promise$asap$$asap(function (promise) {
var sealed = false;
var error = lib$es6$promise$$internal$$tryThen(then, thenable, function (value) {
if (sealed) {
return;
}
sealed = true;
if (thenable !== value) {
lib$es6$promise$$internal$$resolve(promise, value);
} else {
lib$es6$promise$$internal$$fulfill(promise, value);
}
}, function (reason) {
if (sealed) {
return;
}
sealed = true;
lib$es6$promise$$internal$$reject(promise, reason);
}, 'Settle: ' + (promise._label || ' unknown promise'));
if (!sealed && error) {
sealed = true;
lib$es6$promise$$internal$$reject(promise, error);
}
}, promise);
}
function lib$es6$promise$$internal$$handleOwnThenable(promise, thenable) {
if (thenable._state === lib$es6$promise$$internal$$FULFILLED) {
lib$es6$promise$$internal$$fulfill(promise, thenable._result);
} else if (thenable._state === lib$es6$promise$$internal$$REJECTED) {
lib$es6$promise$$internal$$reject(promise, thenable._result);
} else {
lib$es6$promise$$internal$$subscribe(thenable, undefined, function (value) {
lib$es6$promise$$internal$$resolve(promise, value);
}, function (reason) {
lib$es6$promise$$internal$$reject(promise, reason);
});
}
}
function lib$es6$promise$$internal$$handleMaybeThenable(promise, maybeThenable) {
if (maybeThenable.constructor === promise.constructor) {
lib$es6$promise$$internal$$handleOwnThenable(promise, maybeThenable);
} else {
var then = lib$es6$promise$$internal$$getThen(maybeThenable);
if (then === lib$es6$promise$$internal$$GET_THEN_ERROR) {
lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$GET_THEN_ERROR.error);
} else if (then === undefined) {
lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
} else if (lib$es6$promise$utils$$isFunction(then)) {
lib$es6$promise$$internal$$handleForeignThenable(promise, maybeThenable, then);
} else {
lib$es6$promise$$internal$$fulfill(promise, maybeThenable);
}
}
}
function lib$es6$promise$$internal$$resolve(promise, value) {
if (promise === value) {
lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$selfFulfillment());
} else if (lib$es6$promise$utils$$objectOrFunction(value)) {
lib$es6$promise$$internal$$handleMaybeThenable(promise, value);
} else {
lib$es6$promise$$internal$$fulfill(promise, value);
}
}
function lib$es6$promise$$internal$$publishRejection(promise) {
if (promise._onerror) {
promise._onerror(promise._result);
}
lib$es6$promise$$internal$$publish(promise);
}
function lib$es6$promise$$internal$$fulfill(promise, value) {
if (promise._state !== lib$es6$promise$$internal$$PENDING) {
return;
}
promise._result = value;
promise._state = lib$es6$promise$$internal$$FULFILLED;
if (promise._subscribers.length !== 0) {
lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, promise);
}
}
function lib$es6$promise$$internal$$reject(promise, reason) {
if (promise._state !== lib$es6$promise$$internal$$PENDING) {
return;
}
promise._state = lib$es6$promise$$internal$$REJECTED;
promise._result = reason;
lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publishRejection, promise);
}
function lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection) {
var subscribers = parent._subscribers;
var length = subscribers.length;
parent._onerror = null;
subscribers[length] = child;
subscribers[length + lib$es6$promise$$internal$$FULFILLED] = onFulfillment;
subscribers[length + lib$es6$promise$$internal$$REJECTED] = onRejection;
if (length === 0 && parent._state) {
lib$es6$promise$asap$$asap(lib$es6$promise$$internal$$publish, parent);
}
}
function lib$es6$promise$$internal$$publish(promise) {
var subscribers = promise._subscribers;
var settled = promise._state;
if (subscribers.length === 0) {
return;
}
var child, callback, detail = promise._result;
for (var i = 0; i < subscribers.length; i += 3) {
child = subscribers[i];
callback = subscribers[i + settled];
if (child) {
lib$es6$promise$$internal$$invokeCallback(settled, child, callback, detail);
} else {
callback(detail);
}
}
promise._subscribers.length = 0;
}
function lib$es6$promise$$internal$$ErrorObject() {
this.error = null;
}
var lib$es6$promise$$internal$$TRY_CATCH_ERROR = new lib$es6$promise$$internal$$ErrorObject();
function lib$es6$promise$$internal$$tryCatch(callback, detail) {
try {
return callback(detail);
} catch (e) {
lib$es6$promise$$internal$$TRY_CATCH_ERROR.error = e;
return lib$es6$promise$$internal$$TRY_CATCH_ERROR;
}
}
function lib$es6$promise$$internal$$invokeCallback(settled, promise, callback, detail) {
var hasCallback = lib$es6$promise$utils$$isFunction(callback), value, error, succeeded, failed;
if (hasCallback) {
value = lib$es6$promise$$internal$$tryCatch(callback, detail);
if (value === lib$es6$promise$$internal$$TRY_CATCH_ERROR) {
failed = true;
error = value.error;
value = null;
} else {
succeeded = true;
}
if (promise === value) {
lib$es6$promise$$internal$$reject(promise, lib$es6$promise$$internal$$cannotReturnOwn());
return;
}
} else {
value = detail;
succeeded = true;
}
if (promise._state !== lib$es6$promise$$internal$$PENDING) {
} else if (hasCallback && succeeded) {
lib$es6$promise$$internal$$resolve(promise, value);
} else if (failed) {
lib$es6$promise$$internal$$reject(promise, error);
} else if (settled === lib$es6$promise$$internal$$FULFILLED) {
lib$es6$promise$$internal$$fulfill(promise, value);
} else if (settled === lib$es6$promise$$internal$$REJECTED) {
lib$es6$promise$$internal$$reject(promise, value);
}
}
function lib$es6$promise$$internal$$initializePromise(promise, resolver) {
try {
resolver(function resolvePromise(value) {
lib$es6$promise$$internal$$resolve(promise, value);
}, function rejectPromise(reason) {
lib$es6$promise$$internal$$reject(promise, reason);
});
} catch (e) {
lib$es6$promise$$internal$$reject(promise, e);
}
}
function lib$es6$promise$enumerator$$Enumerator(Constructor, input) {
var enumerator = this;
enumerator._instanceConstructor = Constructor;
enumerator.promise = new Constructor(lib$es6$promise$$internal$$noop);
if (enumerator._validateInput(input)) {
enumerator._input = input;
enumerator.length = input.length;
enumerator._remaining = input.length;
enumerator._init();
if (enumerator.length === 0) {
lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
} else {
enumerator.length = enumerator.length || 0;
enumerator._enumerate();
if (enumerator._remaining === 0) {
lib$es6$promise$$internal$$fulfill(enumerator.promise, enumerator._result);
}
}
} else {
lib$es6$promise$$internal$$reject(enumerator.promise, enumerator._validationError());
}
}
lib$es6$promise$enumerator$$Enumerator.prototype._validateInput = function (input) {
return lib$es6$promise$utils$$isArray(input);
};
lib$es6$promise$enumerator$$Enumerator.prototype._validationError = function () {
return new Error('Array Methods must be provided an Array');
};
lib$es6$promise$enumerator$$Enumerator.prototype._init = function () {
this._result = new Array(this.length);
};
var lib$es6$promise$enumerator$$default = lib$es6$promise$enumerator$$Enumerator;
lib$es6$promise$enumerator$$Enumerator.prototype._enumerate = function () {
var enumerator = this;
var length = enumerator.length;
var promise = enumerator.promise;
var input = enumerator._input;
for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
enumerator._eachEntry(input[i], i);
}
};
lib$es6$promise$enumerator$$Enumerator.prototype._eachEntry = function (entry, i) {
var enumerator = this;
var c = enumerator._instanceConstructor;
if (lib$es6$promise$utils$$isMaybeThenable(entry)) {
if (entry.constructor === c && entry._state !== lib$es6$promise$$internal$$PENDING) {
entry._onerror = null;
enumerator._settledAt(entry._state, i, entry._result);
} else {
enumerator._willSettleAt(c.resolve(entry), i);
}
} else {
enumerator._remaining--;
enumerator._result[i] = entry;
}
};
lib$es6$promise$enumerator$$Enumerator.prototype._settledAt = function (state, i, value) {
var enumerator = this;
var promise = enumerator.promise;
if (promise._state === lib$es6$promise$$internal$$PENDING) {
enumerator._remaining--;
if (state === lib$es6$promise$$internal$$REJECTED) {
lib$es6$promise$$internal$$reject(promise, value);
} else {
enumerator._result[i] = value;
}
}
if (enumerator._remaining === 0) {
lib$es6$promise$$internal$$fulfill(promise, enumerator._result);
}
};
lib$es6$promise$enumerator$$Enumerator.prototype._willSettleAt = function (promise, i) {
var enumerator = this;
lib$es6$promise$$internal$$subscribe(promise, undefined, function (value) {
enumerator._settledAt(lib$es6$promise$$internal$$FULFILLED, i, value);
}, function (reason) {
enumerator._settledAt(lib$es6$promise$$internal$$REJECTED, i, reason);
});
};
function lib$es6$promise$promise$all$$all(entries) {
return new lib$es6$promise$enumerator$$default(this, entries).promise;
}
var lib$es6$promise$promise$all$$default = lib$es6$promise$promise$all$$all;
function lib$es6$promise$promise$race$$race(entries) {
var Constructor = this;
var promise = new Constructor(lib$es6$promise$$internal$$noop);
if (!lib$es6$promise$utils$$isArray(entries)) {
lib$es6$promise$$internal$$reject(promise, new TypeError('You must pass an array to race.'));
return promise;
}
var length = entries.length;
function onFulfillment(value) {
lib$es6$promise$$internal$$resolve(promise, value);
}
function onRejection(reason) {
lib$es6$promise$$internal$$reject(promise, reason);
}
for (var i = 0; promise._state === lib$es6$promise$$internal$$PENDING && i < length; i++) {
lib$es6$promise$$internal$$subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
}
return promise;
}
var lib$es6$promise$promise$race$$default = lib$es6$promise$promise$race$$race;
function lib$es6$promise$promise$resolve$$resolve(object) {
var Constructor = this;
if (object && typeof object === 'object' && object.constructor === Constructor) {
return object;
}
var promise = new Constructor(lib$es6$promise$$internal$$noop);
lib$es6$promise$$internal$$resolve(promise, object);
return promise;
}
var lib$es6$promise$promise$resolve$$default = lib$es6$promise$promise$resolve$$resolve;
function lib$es6$promise$promise$reject$$reject(reason) {
var Constructor = this;
var promise = new Constructor(lib$es6$promise$$internal$$noop);
lib$es6$promise$$internal$$reject(promise, reason);
return promise;
}
var lib$es6$promise$promise$reject$$default = lib$es6$promise$promise$reject$$reject;
var lib$es6$promise$promise$$counter = 0;
function lib$es6$promise$promise$$needsResolver() {
throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}
function lib$es6$promise$promise$$needsNew() {
throw new TypeError('Failed to construct \'Promise\': Please use the \'new\' operator, this object constructor cannot be called as a function.');
}
var lib$es6$promise$promise$$default = lib$es6$promise$promise$$Promise;
function lib$es6$promise$promise$$Promise(resolver) {
this._id = lib$es6$promise$promise$$counter++;
this._state = undefined;
this._result = undefined;
this._subscribers = [];
if (lib$es6$promise$$internal$$noop !== resolver) {
if (!lib$es6$promise$utils$$isFunction(resolver)) {
lib$es6$promise$promise$$needsResolver();
}
if (!(this instanceof lib$es6$promise$promise$$Promise)) {
lib$es6$promise$promise$$needsNew();
}
lib$es6$promise$$internal$$initializePromise(this, resolver);
}
}
lib$es6$promise$promise$$Promise.all = lib$es6$promise$promise$all$$default;
lib$es6$promise$promise$$Promise.race = lib$es6$promise$promise$race$$default;
lib$es6$promise$promise$$Promise.resolve = lib$es6$promise$promise$resolve$$default;
lib$es6$promise$promise$$Promise.reject = lib$es6$promise$promise$reject$$default;
lib$es6$promise$promise$$Promise._setScheduler = lib$es6$promise$asap$$setScheduler;
lib$es6$promise$promise$$Promise._setAsap = lib$es6$promise$asap$$setAsap;
lib$es6$promise$promise$$Promise._asap = lib$es6$promise$asap$$asap;
lib$es6$promise$promise$$Promise.prototype = {
constructor: lib$es6$promise$promise$$Promise,
then: function (onFulfillment, onRejection) {
var parent = this;
var state = parent._state;
if (state === lib$es6$promise$$internal$$FULFILLED && !onFulfillment || state === lib$es6$promise$$internal$$REJECTED && !onRejection) {
return this;
}
var child = new this.constructor(lib$es6$promise$$internal$$noop);
var result = parent._result;
if (state) {
var callback = arguments[state - 1];
lib$es6$promise$asap$$asap(function () {
lib$es6$promise$$internal$$invokeCallback(state, child, callback, result);
});
} else {
lib$es6$promise$$internal$$subscribe(parent, child, onFulfillment, onRejection);
}
return child;
},
'catch': function (onRejection) {
return this.then(null, onRejection);
}
};
function lib$es6$promise$polyfill$$polyfill() {
var local;
if (typeof global !== 'undefined') {
local = global;
} else if (typeof self !== 'undefined') {
local = self;
} else {
try {
local = Function('return this')();
} catch (e) {
throw new Error('polyfill failed because global object is unavailable in this environment');
}
}
var P = local.Promise;
if (P && Object.prototype.toString.call(P.resolve()) === '[object Promise]' && !P.cast) {
return;
}
local.Promise = lib$es6$promise$promise$$default;
}
var lib$es6$promise$polyfill$$default = lib$es6$promise$polyfill$$polyfill;
var lib$es6$promise$umd$$ES6Promise = {
Promise: lib$es6$promise$promise$$default,
polyfill: lib$es6$promise$polyfill$$default
};
if (typeof define === 'function' && define['amd']) {
define(function () {
return lib$es6$promise$umd$$ES6Promise;
});
} else if (typeof module !== 'undefined' && module['exports']) {
module['exports'] = lib$es6$promise$umd$$ES6Promise;
} else if (typeof this !== 'undefined') {
this['ES6Promise'] = lib$es6$promise$umd$$ES6Promise;
}
lib$es6$promise$polyfill$$default();
}.call(this));
!function () {
var d3 = { version: '3.5.17' };
var d3_arraySlice = [].slice, d3_array = function (list) {
return d3_arraySlice.call(list);
};
var d3_document = this.document;
function d3_documentElement(node) {
return node && (node.ownerDocument || node.document || node).documentElement;
}
function d3_window(node) {
return node && (node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView);
}
if (d3_document) {
try {
d3_array(d3_document.documentElement.childNodes)[0].nodeType;
} catch (e) {
d3_array = function (list) {
var i = list.length, array = new Array(i);
while (i--)
array[i] = list[i];
return array;
};
}
}
if (!Date.now)
Date.now = function () {
return +new Date();
};
if (d3_document) {
try {
d3_document.createElement('DIV').style.setProperty('opacity', 0, '');
} catch (error) {
var d3_element_prototype = this.Element.prototype, d3_element_setAttribute = d3_element_prototype.setAttribute, d3_element_setAttributeNS = d3_element_prototype.setAttributeNS, d3_style_prototype = this.CSSStyleDeclaration.prototype, d3_style_setProperty = d3_style_prototype.setProperty;
d3_element_prototype.setAttribute = function (name, value) {
d3_element_setAttribute.call(this, name, value + '');
};
d3_element_prototype.setAttributeNS = function (space, local, value) {
d3_element_setAttributeNS.call(this, space, local, value + '');
};
d3_style_prototype.setProperty = function (name, value, priority) {
d3_style_setProperty.call(this, name, value + '', priority);
};
}
}
d3.ascending = d3_ascending;
function d3_ascending(a, b) {
return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}
d3.descending = function (a, b) {
return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
};
d3.min = function (array, f) {
var i = -1, n = array.length, a, b;
if (arguments.length === 1) {
while (++i < n)
if ((b = array[i]) != null && b >= b) {
a = b;
break;
}
while (++i < n)
if ((b = array[i]) != null && a > b)
a = b;
} else {
while (++i < n)
if ((b = f.call(array, array[i], i)) != null && b >= b) {
a = b;
break;
}
while (++i < n)
if ((b = f.call(array, array[i], i)) != null && a > b)
a = b;
}
return a;
};
d3.max = function (array, f) {
var i = -1, n = array.length, a, b;
if (arguments.length === 1) {
while (++i < n)
if ((b = array[i]) != null && b >= b) {
a = b;
break;
}
while (++i < n)
if ((b = array[i]) != null && b > a)
a = b;
} else {
while (++i < n)
if ((b = f.call(array, array[i], i)) != null && b >= b) {
a = b;
break;
}
while (++i < n)
if ((b = f.call(array, array[i], i)) != null && b > a)
a = b;
}
return a;
};
d3.extent = function (array, f) {
var i = -1, n = array.length, a, b, c;
if (arguments.length === 1) {
while (++i < n)
if ((b = array[i]) != null && b >= b) {
a = c = b;
break;
}
while (++i < n)
if ((b = array[i]) != null) {
if (a > b)
a = b;
if (c < b)
c = b;
}
} else {
while (++i < n)
if ((b = f.call(array, array[i], i)) != null && b >= b) {
a = c = b;
break;
}
while (++i < n)
if ((b = f.call(array, array[i], i)) != null) {
if (a > b)
a = b;
if (c < b)
c = b;
}
}
return [
a,
c
];
};
function d3_number(x) {
return x === null ? NaN : +x;
}
function d3_numeric(x) {
return !isNaN(x);
}
d3.sum = function (array, f) {
var s = 0, n = array.length, a, i = -1;
if (arguments.length === 1) {
while (++i < n)
if (d3_numeric(a = +array[i]))
s += a;
} else {
while (++i < n)
if (d3_numeric(a = +f.call(array, array[i], i)))
s += a;
}
return s;
};
d3.mean = function (array, f) {
var s = 0, n = array.length, a, i = -1, j = n;
if (arguments.length === 1) {
while (++i < n)
if (d3_numeric(a = d3_number(array[i])))
s += a;
else
--j;
} else {
while (++i < n)
if (d3_numeric(a = d3_number(f.call(array, array[i], i))))
s += a;
else
--j;
}
if (j)
return s / j;
};
d3.quantile = function (values, p) {
var H = (values.length - 1) * p + 1, h = Math.floor(H), v = +values[h - 1], e = H - h;
return e ? v + e * (values[h] - v) : v;
};
d3.median = function (array, f) {
var numbers = [], n = array.length, a, i = -1;
if (arguments.length === 1) {
while (++i < n)
if (d3_numeric(a = d3_number(array[i])))
numbers.push(a);
} else {
while (++i < n)
if (d3_numeric(a = d3_number(f.call(array, array[i], i))))
numbers.push(a);
}
if (numbers.length)
return d3.quantile(numbers.sort(d3_ascending), 0.5);
};
d3.variance = function (array, f) {
var n = array.length, m = 0, a, d, s = 0, i = -1, j = 0;
if (arguments.length === 1) {
while (++i < n) {
if (d3_numeric(a = d3_number(array[i]))) {
d = a - m;
m += d / ++j;
s += d * (a - m);
}
}
} else {
while (++i < n) {
if (d3_numeric(a = d3_number(f.call(array, array[i], i)))) {
d = a - m;
m += d / ++j;
s += d * (a - m);
}
}
}
if (j > 1)
return s / (j - 1);
};
d3.deviation = function () {
var v = d3.variance.apply(this, arguments);
return v ? Math.sqrt(v) : v;
};
function d3_bisector(compare) {
return {
left: function (a, x, lo, hi) {
if (arguments.length < 3)
lo = 0;
if (arguments.length < 4)
hi = a.length;
while (lo < hi) {
var mid = lo + hi >>> 1;
if (compare(a[mid], x) < 0)
lo = mid + 1;
else
hi = mid;
}
return lo;
},
right: function (a, x, lo, hi) {
if (arguments.length < 3)
lo = 0;
if (arguments.length < 4)
hi = a.length;
while (lo < hi) {
var mid = lo + hi >>> 1;
if (compare(a[mid], x) > 0)
hi = mid;
else
lo = mid + 1;
}
return lo;
}
};
}
var d3_bisect = d3_bisector(d3_ascending);
d3.bisectLeft = d3_bisect.left;
d3.bisect = d3.bisectRight = d3_bisect.right;
d3.bisector = function (f) {
return d3_bisector(f.length === 1 ? function (d, x) {
return d3_ascending(f(d), x);
} : f);
};
d3.shuffle = function (array, i0, i1) {
if ((m = arguments.length) < 3) {
i1 = array.length;
if (m < 2)
i0 = 0;
}
var m = i1 - i0, t, i;
while (m) {
i = Math.random() * m-- | 0;
t = array[m + i0], array[m + i0] = array[i + i0], array[i + i0] = t;
}
return array;
};
d3.permute = function (array, indexes) {
var i = indexes.length, permutes = new Array(i);
while (i--)
permutes[i] = array[indexes[i]];
return permutes;
};
d3.pairs = function (array) {
var i = 0, n = array.length - 1, p0, p1 = array[0], pairs = new Array(n < 0 ? 0 : n);
while (i < n)
pairs[i] = [
p0 = p1,
p1 = array[++i]
];
return pairs;
};
d3.transpose = function (matrix) {
if (!(n = matrix.length))
return [];
for (var i = -1, m = d3.min(matrix, d3_transposeLength), transpose = new Array(m); ++i < m;) {
for (var j = -1, n, row = transpose[i] = new Array(n); ++j < n;) {
row[j] = matrix[j][i];
}
}
return transpose;
};
function d3_transposeLength(d) {
return d.length;
}
d3.zip = function () {
return d3.transpose(arguments);
};
d3.keys = function (map) {
var keys = [];
for (var key in map)
keys.push(key);
return keys;
};
d3.values = function (map) {
var values = [];
for (var key in map)
values.push(map[key]);
return values;
};
d3.entries = function (map) {
var entries = [];
for (var key in map)
entries.push({
key: key,
value: map[key]
});
return entries;
};
d3.merge = function (arrays) {
var n = arrays.length, m, i = -1, j = 0, merged, array;
while (++i < n)
j += arrays[i].length;
merged = new Array(j);
while (--n >= 0) {
array = arrays[n];
m = array.length;
while (--m >= 0) {
merged[--j] = array[m];
}
}
return merged;
};
var abs = Math.abs;
d3.range = function (start, stop, step) {
if (arguments.length < 3) {
step = 1;
if (arguments.length < 2) {
stop = start;
start = 0;
}
}
if ((stop - start) / step === Infinity)
throw new Error('infinite range');
var range = [], k = d3_range_integerScale(abs(step)), i = -1, j;
start *= k, stop *= k, step *= k;
if (step < 0)
while ((j = start + step * ++i) > stop)
range.push(j / k);
else
while ((j = start + step * ++i) < stop)
range.push(j / k);
return range;
};
function d3_range_integerScale(x) {
var k = 1;
while (x * k % 1)
k *= 10;
return k;
}
function d3_class(ctor, properties) {
for (var key in properties) {
Object.defineProperty(ctor.prototype, key, {
value: properties[key],
enumerable: false
});
}
}
d3.map = function (object, f) {
var map = new d3_Map();
if (object instanceof d3_Map) {
object.forEach(function (key, value) {
map.set(key, value);
});
} else if (Array.isArray(object)) {
var i = -1, n = object.length, o;
if (arguments.length === 1)
while (++i < n)
map.set(i, object[i]);
else
while (++i < n)
map.set(f.call(object, o = object[i], i), o);
} else {
for (var key in object)
map.set(key, object[key]);
}
return map;
};
function d3_Map() {
this._ = Object.create(null);
}
var d3_map_proto = '__proto__', d3_map_zero = '\0';
d3_class(d3_Map, {
has: d3_map_has,
get: function (key) {
return this._[d3_map_escape(key)];
},
set: function (key, value) {
return this._[d3_map_escape(key)] = value;
},
remove: d3_map_remove,
keys: d3_map_keys,
values: function () {
var values = [];
for (var key in this._)
values.push(this._[key]);
return values;
},
entries: function () {
var entries = [];
for (var key in this._)
entries.push({
key: d3_map_unescape(key),
value: this._[key]
});
return entries;
},
size: d3_map_size,
empty: d3_map_empty,
forEach: function (f) {
for (var key in this._)
f.call(this, d3_map_unescape(key), this._[key]);
}
});
function d3_map_escape(key) {
return (key += '') === d3_map_proto || key[0] === d3_map_zero ? d3_map_zero + key : key;
}
function d3_map_unescape(key) {
return (key += '')[0] === d3_map_zero ? key.slice(1) : key;
}
function d3_map_has(key) {
return d3_map_escape(key) in this._;
}
function d3_map_remove(key) {
return (key = d3_map_escape(key)) in this._ && delete this._[key];
}
function d3_map_keys() {
var keys = [];
for (var key in this._)
keys.push(d3_map_unescape(key));
return keys;
}
function d3_map_size() {
var size = 0;
for (var key in this._)
++size;
return size;
}
function d3_map_empty() {
for (var key in this._)
return false;
return true;
}
d3.nest = function () {
var nest = {}, keys = [], sortKeys = [], sortValues, rollup;
function map(mapType, array, depth) {
if (depth >= keys.length)
return rollup ? rollup.call(nest, array) : sortValues ? array.sort(sortValues) : array;
var i = -1, n = array.length, key = keys[depth++], keyValue, object, setter, valuesByKey = new d3_Map(), values;
while (++i < n) {
if (values = valuesByKey.get(keyValue = key(object = array[i]))) {
values.push(object);
} else {
valuesByKey.set(keyValue, [object]);
}
}
if (mapType) {
object = mapType();
setter = function (keyValue, values) {
object.set(keyValue, map(mapType, values, depth));
};
} else {
object = {};
setter = function (keyValue, values) {
object[keyValue] = map(mapType, values, depth);
};
}
valuesByKey.forEach(setter);
return object;
}
function entries(map, depth) {
if (depth >= keys.length)
return map;
var array = [], sortKey = sortKeys[depth++];
map.forEach(function (key, keyMap) {
array.push({
key: key,
values: entries(keyMap, depth)
});
});
return sortKey ? array.sort(function (a, b) {
return sortKey(a.key, b.key);
}) : array;
}
nest.map = function (array, mapType) {
return map(mapType, array, 0);
};
nest.entries = function (array) {
return entries(map(d3.map, array, 0), 0);
};
nest.key = function (d) {
keys.push(d);
return nest;
};
nest.sortKeys = function (order) {
sortKeys[keys.length - 1] = order;
return nest;
};
nest.sortValues = function (order) {
sortValues = order;
return nest;
};
nest.rollup = function (f) {
rollup = f;
return nest;
};
return nest;
};
d3.set = function (array) {
var set = new d3_Set();
if (array)
for (var i = 0, n = array.length; i < n; ++i)
set.add(array[i]);
return set;
};
function d3_Set() {
this._ = Object.create(null);
}
d3_class(d3_Set, {
has: d3_map_has,
add: function (key) {
this._[d3_map_escape(key += '')] = true;
return key;
},
remove: d3_map_remove,
values: d3_map_keys,
size: d3_map_size,
empty: d3_map_empty,
forEach: function (f) {
for (var key in this._)
f.call(this, d3_map_unescape(key));
}
});
d3.behavior = {};
function d3_identity(d) {
return d;
}
d3.rebind = function (target, source) {
var i = 1, n = arguments.length, method;
while (++i < n)
target[method = arguments[i]] = d3_rebind(target, source, source[method]);
return target;
};
function d3_rebind(target, source, method) {
return function () {
var value = method.apply(source, arguments);
return value === source ? target : value;
};
}
function d3_vendorSymbol(object, name) {
if (name in object)
return name;
name = name.charAt(0).toUpperCase() + name.slice(1);
for (var i = 0, n = d3_vendorPrefixes.length; i < n; ++i) {
var prefixName = d3_vendorPrefixes[i] + name;
if (prefixName in object)
return prefixName;
}
}
var d3_vendorPrefixes = [
'webkit',
'ms',
'moz',
'Moz',
'o',
'O'
];
function d3_noop() {
}
d3.dispatch = function () {
var dispatch = new d3_dispatch(), i = -1, n = arguments.length;
while (++i < n)
dispatch[arguments[i]] = d3_dispatch_event(dispatch);
return dispatch;
};
function d3_dispatch() {
}
d3_dispatch.prototype.on = function (type, listener) {
var i = type.indexOf('.'), name = '';
if (i >= 0) {
name = type.slice(i + 1);
type = type.slice(0, i);
}
if (type)
return arguments.length < 2 ? this[type].on(name) : this[type].on(name, listener);
if (arguments.length === 2) {
if (listener == null)
for (type in this) {
if (this.hasOwnProperty(type))
this[type].on(name, null);
}
return this;
}
};
function d3_dispatch_event(dispatch) {
var listeners = [], listenerByName = new d3_Map();
function event() {
var z = listeners, i = -1, n = z.length, l;
while (++i < n)
if (l = z[i].on)
l.apply(this, arguments);
return dispatch;
}
event.on = function (name, listener) {
var l = listenerByName.get(name), i;
if (arguments.length < 2)
return l && l.on;
if (l) {
l.on = null;
listeners = listeners.slice(0, i = listeners.indexOf(l)).concat(listeners.slice(i + 1));
listenerByName.remove(name);
}
if (listener)
listeners.push(listenerByName.set(name, { on: listener }));
return dispatch;
};
return event;
}
d3.event = null;
function d3_eventPreventDefault() {
d3.event.preventDefault();
}
function d3_eventSource() {
var e = d3.event, s;
while (s = e.sourceEvent)
e = s;
return e;
}
function d3_eventDispatch(target) {
var dispatch = new d3_dispatch(), i = 0, n = arguments.length;
while (++i < n)
dispatch[arguments[i]] = d3_dispatch_event(dispatch);
dispatch.of = function (thiz, argumentz) {
return function (e1) {
try {
var e0 = e1.sourceEvent = d3.event;
e1.target = target;
d3.event = e1;
dispatch[e1.type].apply(thiz, argumentz);
} finally {
d3.event = e0;
}
};
};
return dispatch;
}
d3.requote = function (s) {
return s.replace(d3_requote_re, '\\$&');
};
var d3_requote_re = /[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g;
var d3_subclass = {}.__proto__ ? function (object, prototype) {
object.__proto__ = prototype;
} : function (object, prototype) {
for (var property in prototype)
object[property] = prototype[property];
};
function d3_selection(groups) {
d3_subclass(groups, d3_selectionPrototype);
return groups;
}
var d3_select = function (s, n) {
return n.querySelector(s);
}, d3_selectAll = function (s, n) {
return n.querySelectorAll(s);
}, d3_selectMatches = function (n, s) {
var d3_selectMatcher = n.matches || n[d3_vendorSymbol(n, 'matchesSelector')];
d3_selectMatches = function (n, s) {
return d3_selectMatcher.call(n, s);
};
return d3_selectMatches(n, s);
};
if (typeof Sizzle === 'function') {
d3_select = function (s, n) {
return Sizzle(s, n)[0] || null;
};
d3_selectAll = Sizzle;
d3_selectMatches = Sizzle.matchesSelector;
}
d3.selection = function () {
return d3.select(d3_document.documentElement);
};
var d3_selectionPrototype = d3.selection.prototype = [];
d3_selectionPrototype.select = function (selector) {
var subgroups = [], subgroup, subnode, group, node;
selector = d3_selection_selector(selector);
for (var j = -1, m = this.length; ++j < m;) {
subgroups.push(subgroup = []);
subgroup.parentNode = (group = this[j]).parentNode;
for (var i = -1, n = group.length; ++i < n;) {
if (node = group[i]) {
subgroup.push(subnode = selector.call(node, node.__data__, i, j));
if (subnode && '__data__' in node)
subnode.__data__ = node.__data__;
} else {
subgroup.push(null);
}
}
}
return d3_selection(subgroups);
};
function d3_selection_selector(selector) {
return typeof selector === 'function' ? selector : function () {
return d3_select(selector, this);
};
}
d3_selectionPrototype.selectAll = function (selector) {
var subgroups = [], subgroup, node;
selector = d3_selection_selectorAll(selector);
for (var j = -1, m = this.length; ++j < m;) {
for (var group = this[j], i = -1, n = group.length; ++i < n;) {
if (node = group[i]) {
subgroups.push(subgroup = d3_array(selector.call(node, node.__data__, i, j)));
subgroup.parentNode = node;
}
}
}
return d3_selection(subgroups);
};
function d3_selection_selectorAll(selector) {
return typeof selector === 'function' ? selector : function () {
return d3_selectAll(selector, this);
};
}
var d3_nsXhtml = 'http://www.w3.org/1999/xhtml';
var d3_nsPrefix = {
svg: 'http://www.w3.org/2000/svg',
xhtml: d3_nsXhtml,
xlink: 'http://www.w3.org/1999/xlink',
xml: 'http://www.w3.org/XML/1998/namespace',
xmlns: 'http://www.w3.org/2000/xmlns/'
};
d3.ns = {
prefix: d3_nsPrefix,
qualify: function (name) {
var i = name.indexOf(':'), prefix = name;
if (i >= 0 && (prefix = name.slice(0, i)) !== 'xmlns')
name = name.slice(i + 1);
return d3_nsPrefix.hasOwnProperty(prefix) ? {
space: d3_nsPrefix[prefix],
local: name
} : name;
}
};
d3_selectionPrototype.attr = function (name, value) {
if (arguments.length < 2) {
if (typeof name === 'string') {
var node = this.node();
name = d3.ns.qualify(name);
return name.local ? node.getAttributeNS(name.space, name.local) : node.getAttribute(name);
}
for (value in name)
this.each(d3_selection_attr(value, name[value]));
return this;
}
return this.each(d3_selection_attr(name, value));
};
function d3_selection_attr(name, value) {
name = d3.ns.qualify(name);
function attrNull() {
this.removeAttribute(name);
}
function attrNullNS() {
this.removeAttributeNS(name.space, name.local);
}
function attrConstant() {
this.setAttribute(name, value);
}
function attrConstantNS() {
this.setAttributeNS(name.space, name.local, value);
}
function attrFunction() {
var x = value.apply(this, arguments);
if (x == null)
this.removeAttribute(name);
else
this.setAttribute(name, x);
}
function attrFunctionNS() {
var x = value.apply(this, arguments);
if (x == null)
this.removeAttributeNS(name.space, name.local);
else
this.setAttributeNS(name.space, name.local, x);
}
return value == null ? name.local ? attrNullNS : attrNull : typeof value === 'function' ? name.local ? attrFunctionNS : attrFunction : name.local ? attrConstantNS : attrConstant;
}
function d3_collapse(s) {
return s.trim().replace(/\s+/g, ' ');
}
d3_selectionPrototype.classed = function (name, value) {
if (arguments.length < 2) {
if (typeof name === 'string') {
var node = this.node(), n = (name = d3_selection_classes(name)).length, i = -1;
if (value = node.classList) {
while (++i < n)
if (!value.contains(name[i]))
return false;
} else {
value = node.getAttribute('class');
while (++i < n)
if (!d3_selection_classedRe(name[i]).test(value))
return false;
}
return true;
}
for (value in name)
this.each(d3_selection_classed(value, name[value]));
return this;
}
return this.each(d3_selection_classed(name, value));
};
function d3_selection_classedRe(name) {
return new RegExp('(?:^|\\s+)' + d3.requote(name) + '(?:\\s+|$)', 'g');
}
function d3_selection_classes(name) {
return (name + '').trim().split(/^|\s+/);
}
function d3_selection_classed(name, value) {
name = d3_selection_classes(name).map(d3_selection_classedName);
var n = name.length;
function classedConstant() {
var i = -1;
while (++i < n)
name[i](this, value);
}
function classedFunction() {
var i = -1, x = value.apply(this, arguments);
while (++i < n)
name[i](this, x);
}
return typeof value === 'function' ? classedFunction : classedConstant;
}
function d3_selection_classedName(name) {
var re = d3_selection_classedRe(name);
return function (node, value) {
if (c = node.classList)
return value ? c.add(name) : c.remove(name);
var c = node.getAttribute('class') || '';
if (value) {
re.lastIndex = 0;
if (!re.test(c))
node.setAttribute('class', d3_collapse(c + ' ' + name));
} else {
node.setAttribute('class', d3_collapse(c.replace(re, ' ')));
}
};
}
d3_selectionPrototype.style = function (name, value, priority) {
var n = arguments.length;
if (n < 3) {
if (typeof name !== 'string') {
if (n < 2)
value = '';
for (priority in name)
this.each(d3_selection_style(priority, name[priority], value));
return this;
}
if (n < 2) {
var node = this.node();
return d3_window(node).getComputedStyle(node, null).getPropertyValue(name);
}
priority = '';
}
return this.each(d3_selection_style(name, value, priority));
};
function d3_selection_style(name, value, priority) {
function styleNull() {
this.style.removeProperty(name);
}
function styleConstant() {
this.style.setProperty(name, value, priority);
}
function styleFunction() {
var x = value.apply(this, arguments);
if (x == null)
this.style.removeProperty(name);
else
this.style.setProperty(name, x, priority);
}
return value == null ? styleNull : typeof value === 'function' ? styleFunction : styleConstant;
}
d3_selectionPrototype.property = function (name, value) {
if (arguments.length < 2) {
if (typeof name === 'string')
return this.node()[name];
for (value in name)
this.each(d3_selection_property(value, name[value]));
return this;
}
return this.each(d3_selection_property(name, value));
};
function d3_selection_property(name, value) {
function propertyNull() {
delete this[name];
}
function propertyConstant() {
this[name] = value;
}
function propertyFunction() {
var x = value.apply(this, arguments);
if (x == null)
delete this[name];
else
this[name] = x;
}
return value == null ? propertyNull : typeof value === 'function' ? propertyFunction : propertyConstant;
}
d3_selectionPrototype.text = function (value) {
return arguments.length ? this.each(typeof value === 'function' ? function () {
var v = value.apply(this, arguments);
this.textContent = v == null ? '' : v;
} : value == null ? function () {
this.textContent = '';
} : function () {
this.textContent = value;
}) : this.node().textContent;
};
d3_selectionPrototype.html = function (value) {
return arguments.length ? this.each(typeof value === 'function' ? function () {
var v = value.apply(this, arguments);
this.innerHTML = v == null ? '' : v;
} : value == null ? function () {
this.innerHTML = '';
} : function () {
this.innerHTML = value;
}) : this.node().innerHTML;
};
d3_selectionPrototype.append = function (name) {
name = d3_selection_creator(name);
return this.select(function () {
return this.appendChild(name.apply(this, arguments));
});
};
function d3_selection_creator(name) {
function create() {
var document = this.ownerDocument, namespace = this.namespaceURI;
return namespace === d3_nsXhtml && document.documentElement.namespaceURI === d3_nsXhtml ? document.createElement(name) : document.createElementNS(namespace, name);
}
function createNS() {
return this.ownerDocument.createElementNS(name.space, name.local);
}
return typeof name === 'function' ? name : (name = d3.ns.qualify(name)).local ? createNS : create;
}
d3_selectionPrototype.insert = function (name, before) {
name = d3_selection_creator(name);
before = d3_selection_selector(before);
return this.select(function () {
return this.insertBefore(name.apply(this, arguments), before.apply(this, arguments) || null);
});
};
d3_selectionPrototype.remove = function () {
return this.each(d3_selectionRemove);
};
function d3_selectionRemove() {
var parent = this.parentNode;
if (parent)
parent.removeChild(this);
}
d3_selectionPrototype.data = function (value, key) {
var i = -1, n = this.length, group, node;
if (!arguments.length) {
value = new Array(n = (group = this[0]).length);
while (++i < n) {
if (node = group[i]) {
value[i] = node.__data__;
}
}
return value;
}
function bind(group, groupData) {
var i, n = group.length, m = groupData.length, n0 = Math.min(n, m), updateNodes = new Array(m), enterNodes = new Array(m), exitNodes = new Array(n), node, nodeData;
if (key) {
var nodeByKeyValue = new d3_Map(), keyValues = new Array(n), keyValue;
for (i = -1; ++i < n;) {
if (node = group[i]) {
if (nodeByKeyValue.has(keyValue = key.call(node, node.__data__, i))) {
exitNodes[i] = node;
} else {
nodeByKeyValue.set(keyValue, node);
}
keyValues[i] = keyValue;
}
}
for (i = -1; ++i < m;) {
if (!(node = nodeByKeyValue.get(keyValue = key.call(groupData, nodeData = groupData[i], i)))) {
enterNodes[i] = d3_selection_dataNode(nodeData);
} else if (node !== true) {
updateNodes[i] = node;
node.__data__ = nodeData;
}
nodeByKeyValue.set(keyValue, true);
}
for (i = -1; ++i < n;) {
if (i in keyValues && nodeByKeyValue.get(keyValues[i]) !== true) {
exitNodes[i] = group[i];
}
}
} else {
for (i = -1; ++i < n0;) {
node = group[i];
nodeData = groupData[i];
if (node) {
node.__data__ = nodeData;
updateNodes[i] = node;
} else {
enterNodes[i] = d3_selection_dataNode(nodeData);
}
}
for (; i < m; ++i) {
enterNodes[i] = d3_selection_dataNode(groupData[i]);
}
for (; i < n; ++i) {
exitNodes[i] = group[i];
}
}
enterNodes.update = updateNodes;
enterNodes.parentNode = updateNodes.parentNode = exitNodes.parentNode = group.parentNode;
enter.push(enterNodes);
update.push(updateNodes);
exit.push(exitNodes);
}
var enter = d3_selection_enter([]), update = d3_selection([]), exit = d3_selection([]);
if (typeof value === 'function') {
while (++i < n) {
bind(group = this[i], value.call(group, group.parentNode.__data__, i));
}
} else {
while (++i < n) {
bind(group = this[i], value);
}
}
update.enter = function () {
return enter;
};
update.exit = function () {
return exit;
};
return update;
};
function d3_selection_dataNode(data) {
return { __data__: data };
}
d3_selectionPrototype.datum = function (value) {
return arguments.length ? this.property('__data__', value) : this.property('__data__');
};
d3_selectionPrototype.filter = function (filter) {
var subgroups = [], subgroup, group, node;
if (typeof filter !== 'function')
filter = d3_selection_filter(filter);
for (var j = 0, m = this.length; j < m; j++) {
subgroups.push(subgroup = []);
subgroup.parentNode = (group = this[j]).parentNode;
for (var i = 0, n = group.length; i < n; i++) {
if ((node = group[i]) && filter.call(node, node.__data__, i, j)) {
subgroup.push(node);
}
}
}
return d3_selection(subgroups);
};
function d3_selection_filter(selector) {
return function () {
return d3_selectMatches(this, selector);
};
}
d3_selectionPrototype.order = function () {
for (var j = -1, m = this.length; ++j < m;) {
for (var group = this[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
if (node = group[i]) {
if (next && next !== node.nextSibling)
next.parentNode.insertBefore(node, next);
next = node;
}
}
}
return this;
};
d3_selectionPrototype.sort = function (comparator) {
comparator = d3_selection_sortComparator.apply(this, arguments);
for (var j = -1, m = this.length; ++j < m;)
this[j].sort(comparator);
return this.order();
};
function d3_selection_sortComparator(comparator) {
if (!arguments.length)
comparator = d3_ascending;
return function (a, b) {
return a && b ? comparator(a.__data__, b.__data__) : !a - !b;
};
}
d3_selectionPrototype.each = function (callback) {
return d3_selection_each(this, function (node, i, j) {
callback.call(node, node.__data__, i, j);
});
};
function d3_selection_each(groups, callback) {
for (var j = 0, m = groups.length; j < m; j++) {
for (var group = groups[j], i = 0, n = group.length, node; i < n; i++) {
if (node = group[i])
callback(node, i, j);
}
}
return groups;
}
d3_selectionPrototype.call = function (callback) {
var args = d3_array(arguments);
callback.apply(args[0] = this, args);
return this;
};
d3_selectionPrototype.empty = function () {
return !this.node();
};
d3_selectionPrototype.node = function () {
for (var j = 0, m = this.length; j < m; j++) {
for (var group = this[j], i = 0, n = group.length; i < n; i++) {
var node = group[i];
if (node)
return node;
}
}
return null;
};
d3_selectionPrototype.size = function () {
var n = 0;
d3_selection_each(this, function () {
++n;
});
return n;
};
function d3_selection_enter(selection) {
d3_subclass(selection, d3_selection_enterPrototype);
return selection;
}
var d3_selection_enterPrototype = [];
d3.selection.enter = d3_selection_enter;
d3.selection.enter.prototype = d3_selection_enterPrototype;
d3_selection_enterPrototype.append = d3_selectionPrototype.append;
d3_selection_enterPrototype.empty = d3_selectionPrototype.empty;
d3_selection_enterPrototype.node = d3_selectionPrototype.node;
d3_selection_enterPrototype.call = d3_selectionPrototype.call;
d3_selection_enterPrototype.size = d3_selectionPrototype.size;
d3_selection_enterPrototype.select = function (selector) {
var subgroups = [], subgroup, subnode, upgroup, group, node;
for (var j = -1, m = this.length; ++j < m;) {
upgroup = (group = this[j]).update;
subgroups.push(subgroup = []);
subgroup.parentNode = group.parentNode;
for (var i = -1, n = group.length; ++i < n;) {
if (node = group[i]) {
subgroup.push(upgroup[i] = subnode = selector.call(group.parentNode, node.__data__, i, j));
subnode.__data__ = node.__data__;
} else {
subgroup.push(null);
}
}
}
return d3_selection(subgroups);
};
d3_selection_enterPrototype.insert = function (name, before) {
if (arguments.length < 2)
before = d3_selection_enterInsertBefore(this);
return d3_selectionPrototype.insert.call(this, name, before);
};
function d3_selection_enterInsertBefore(enter) {
var i0, j0;
return function (d, i, j) {
var group = enter[j].update, n = group.length, node;
if (j != j0)
j0 = j, i0 = 0;
if (i >= i0)
i0 = i + 1;
while (!(node = group[i0]) && ++i0 < n);
return node;
};
}
d3.select = function (node) {
var group;
if (typeof node === 'string') {
group = [d3_select(node, d3_document)];
group.parentNode = d3_document.documentElement;
} else {
group = [node];
group.parentNode = d3_documentElement(node);
}
return d3_selection([group]);
};
d3.selectAll = function (nodes) {
var group;
if (typeof nodes === 'string') {
group = d3_array(d3_selectAll(nodes, d3_document));
group.parentNode = d3_document.documentElement;
} else {
group = d3_array(nodes);
group.parentNode = null;
}
return d3_selection([group]);
};
d3_selectionPrototype.on = function (type, listener, capture) {
var n = arguments.length;
if (n < 3) {
if (typeof type !== 'string') {
if (n < 2)
listener = false;
for (capture in type)
this.each(d3_selection_on(capture, type[capture], listener));
return this;
}
if (n < 2)
return (n = this.node()['__on' + type]) && n._;
capture = false;
}
return this.each(d3_selection_on(type, listener, capture));
};
function d3_selection_on(type, listener, capture) {
var name = '__on' + type, i = type.indexOf('.'), wrap = d3_selection_onListener;
if (i > 0)
type = type.slice(0, i);
var filter = d3_selection_onFilters.get(type);
if (filter)
type = filter, wrap = d3_selection_onFilter;
function onRemove() {
var l = this[name];
if (l) {
this.removeEventListener(type, l, l.$);
delete this[name];
}
}
function onAdd() {
var l = wrap(listener, d3_array(arguments));
onRemove.call(this);
this.addEventListener(type, this[name] = l, l.$ = capture);
l._ = listener;
}
function removeAll() {
var re = new RegExp('^__on([^.]+)' + d3.requote(type) + '$'), match;
for (var name in this) {
if (match = name.match(re)) {
var l = this[name];
this.removeEventListener(match[1], l, l.$);
delete this[name];
}
}
}
return i ? listener ? onAdd : onRemove : listener ? d3_noop : removeAll;
}
var d3_selection_onFilters = d3.map({
mouseenter: 'mouseover',
mouseleave: 'mouseout'
});
if (d3_document) {
d3_selection_onFilters.forEach(function (k) {
if ('on' + k in d3_document)
d3_selection_onFilters.remove(k);
});
}
function d3_selection_onListener(listener, argumentz) {
return function (e) {
var o = d3.event;
d3.event = e;
argumentz[0] = this.__data__;
try {
listener.apply(this, argumentz);
} finally {
d3.event = o;
}
};
}
function d3_selection_onFilter(listener, argumentz) {
var l = d3_selection_onListener(listener, argumentz);
return function (e) {
var target = this, related = e.relatedTarget;
if (!related || related !== target && !(related.compareDocumentPosition(target) & 8)) {
l.call(target, e);
}
};
}
var d3_event_dragSelect, d3_event_dragId = 0;
function d3_event_dragSuppress(node) {
var name = '.dragsuppress-' + ++d3_event_dragId, click = 'click' + name, w = d3.select(d3_window(node)).on('touchmove' + name, d3_eventPreventDefault).on('dragstart' + name, d3_eventPreventDefault).on('selectstart' + name, d3_eventPreventDefault);
if (d3_event_dragSelect == null) {
d3_event_dragSelect = 'onselectstart' in node ? false : d3_vendorSymbol(node.style, 'userSelect');
}
if (d3_event_dragSelect) {
var style = d3_documentElement(node).style, select = style[d3_event_dragSelect];
style[d3_event_dragSelect] = 'none';
}
return function (suppressClick) {
w.on(name, null);
if (d3_event_dragSelect)
style[d3_event_dragSelect] = select;
if (suppressClick) {
var off = function () {
w.on(click, null);
};
w.on(click, function () {
d3_eventPreventDefault();
off();
}, true);
setTimeout(off, 0);
}
};
}
d3.mouse = function (container) {
return d3_mousePoint(container, d3_eventSource());
};
var d3_mouse_bug44083 = this.navigator && /WebKit/.test(this.navigator.userAgent) ? -1 : 0;
function d3_mousePoint(container, e) {
if (e.changedTouches)
e = e.changedTouches[0];
var svg = container.ownerSVGElement || container;
if (svg.createSVGPoint) {
var point = svg.createSVGPoint();
if (d3_mouse_bug44083 < 0) {
var window = d3_window(container);
if (window.scrollX || window.scrollY) {
svg = d3.select('body').append('svg').style({
position: 'absolute',
top: 0,
left: 0,
margin: 0,
padding: 0,
border: 'none'
}, 'important');
var ctm = svg[0][0].getScreenCTM();
d3_mouse_bug44083 = !(ctm.f || ctm.e);
svg.remove();
}
}
if (d3_mouse_bug44083)
point.x = e.pageX, point.y = e.pageY;
else
point.x = e.clientX, point.y = e.clientY;
point = point.matrixTransform(container.getScreenCTM().inverse());
return [
point.x,
point.y
];
}
var rect = container.getBoundingClientRect();
return [
e.clientX - rect.left - container.clientLeft,
e.clientY - rect.top - container.clientTop
];
}
d3.touch = function (container, touches, identifier) {
if (arguments.length < 3)
identifier = touches, touches = d3_eventSource().changedTouches;
if (touches)
for (var i = 0, n = touches.length, touch; i < n; ++i) {
if ((touch = touches[i]).identifier === identifier) {
return d3_mousePoint(container, touch);
}
}
};
d3.behavior.drag = function () {
var event = d3_eventDispatch(drag, 'drag', 'dragstart', 'dragend'), origin = null, mousedown = dragstart(d3_noop, d3.mouse, d3_window, 'mousemove', 'mouseup'), touchstart = dragstart(d3_behavior_dragTouchId, d3.touch, d3_identity, 'touchmove', 'touchend');
function drag() {
this.on('mousedown.drag', mousedown).on('touchstart.drag', touchstart);
}
function dragstart(id, position, subject, move, end) {
return function () {
var that = this, target = d3.event.target.correspondingElement || d3.event.target, parent = that.parentNode, dispatch = event.of(that, arguments), dragged = 0, dragId = id(), dragName = '.drag' + (dragId == null ? '' : '-' + dragId), dragOffset, dragSubject = d3.select(subject(target)).on(move + dragName, moved).on(end + dragName, ended), dragRestore = d3_event_dragSuppress(target), position0 = position(parent, dragId);
if (origin) {
dragOffset = origin.apply(that, arguments);
dragOffset = [
dragOffset.x - position0[0],
dragOffset.y - position0[1]
];
} else {
dragOffset = [
0,
0
];
}
dispatch({ type: 'dragstart' });
function moved() {
var position1 = position(parent, dragId), dx, dy;
if (!position1)
return;
dx = position1[0] - position0[0];
dy = position1[1] - position0[1];
dragged |= dx | dy;
position0 = position1;
dispatch({
type: 'drag',
x: position1[0] + dragOffset[0],
y: position1[1] + dragOffset[1],
dx: dx,
dy: dy
});
}
function ended() {
if (!position(parent, dragId))
return;
dragSubject.on(move + dragName, null).on(end + dragName, null);
dragRestore(dragged);
dispatch({ type: 'dragend' });
}
};
}
drag.origin = function (x) {
if (!arguments.length)
return origin;
origin = x;
return drag;
};
return d3.rebind(drag, event, 'on');
};
function d3_behavior_dragTouchId() {
return d3.event.changedTouches[0].identifier;
}
d3.touches = function (container, touches) {
if (arguments.length < 2)
touches = d3_eventSource().touches;
return touches ? d3_array(touches).map(function (touch) {
var point = d3_mousePoint(container, touch);
point.identifier = touch.identifier;
return point;
}) : [];
};
var ε = 0.000001, ε2 = ε * ε, π = Math.PI, τ = 2 * π, τε = τ - ε, halfπ = π / 2, d3_radians = π / 180, d3_degrees = 180 / π;
function d3_sgn(x) {
return x > 0 ? 1 : x < 0 ? -1 : 0;
}
function d3_cross2d(a, b, c) {
return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function d3_acos(x) {
return x > 1 ? 0 : x < -1 ? π : Math.acos(x);
}
function d3_asin(x) {
return x > 1 ? halfπ : x < -1 ? -halfπ : Math.asin(x);
}
function d3_sinh(x) {
return ((x = Math.exp(x)) - 1 / x) / 2;
}
function d3_cosh(x) {
return ((x = Math.exp(x)) + 1 / x) / 2;
}
function d3_tanh(x) {
return ((x = Math.exp(2 * x)) - 1) / (x + 1);
}
function d3_haversin(x) {
return (x = Math.sin(x / 2)) * x;
}
var ρ = Math.SQRT2, ρ2 = 2, ρ4 = 4;
d3.interpolateZoom = function (p0, p1) {
var ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2], dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, i, S;
if (d2 < ε2) {
S = Math.log(w1 / w0) / ρ;
i = function (t) {
return [
ux0 + t * dx,
uy0 + t * dy,
w0 * Math.exp(ρ * t * S)
];
};
} else {
var d1 = Math.sqrt(d2), b0 = (w1 * w1 - w0 * w0 + ρ4 * d2) / (2 * w0 * ρ2 * d1), b1 = (w1 * w1 - w0 * w0 - ρ4 * d2) / (2 * w1 * ρ2 * d1), r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
S = (r1 - r0) / ρ;
i = function (t) {
var s = t * S, coshr0 = d3_cosh(r0), u = w0 / (ρ2 * d1) * (coshr0 * d3_tanh(ρ * s + r0) - d3_sinh(r0));
return [
ux0 + u * dx,
uy0 + u * dy,
w0 * coshr0 / d3_cosh(ρ * s + r0)
];
};
}
i.duration = S * 1000;
return i;
};
d3.behavior.zoom = function () {
var view = {
x: 0,
y: 0,
k: 1
}, translate0, center0, center, size = [
960,
500
], scaleExtent = d3_behavior_zoomInfinity, duration = 250, zooming = 0, mousedown = 'mousedown.zoom', mousemove = 'mousemove.zoom', mouseup = 'mouseup.zoom', mousewheelTimer, touchstart = 'touchstart.zoom', touchtime, event = d3_eventDispatch(zoom, 'zoomstart', 'zoom', 'zoomend'), x0, x1, y0, y1;
if (!d3_behavior_zoomWheel) {
d3_behavior_zoomWheel = 'onwheel' in d3_document ? (d3_behavior_zoomDelta = function () {
return -d3.event.deltaY * (d3.event.deltaMode ? 120 : 1);
}, 'wheel') : 'onmousewheel' in d3_document ? (d3_behavior_zoomDelta = function () {
return d3.event.wheelDelta;
}, 'mousewheel') : (d3_behavior_zoomDelta = function () {
return -d3.event.detail;
}, 'MozMousePixelScroll');
}
function zoom(g) {
g.on(mousedown, mousedowned).on(d3_behavior_zoomWheel + '.zoom', mousewheeled).on('dblclick.zoom', dblclicked).on(touchstart, touchstarted);
}
zoom.event = function (g) {
g.each(function () {
var dispatch = event.of(this, arguments), view1 = view;
if (d3_transitionInheritId) {
d3.select(this).transition().each('start.zoom', function () {
view = this.__chart__ || {
x: 0,
y: 0,
k: 1
};
zoomstarted(dispatch);
}).tween('zoom:zoom', function () {
var dx = size[0], dy = size[1], cx = center0 ? center0[0] : dx / 2, cy = center0 ? center0[1] : dy / 2, i = d3.interpolateZoom([
(cx - view.x) / view.k,
(cy - view.y) / view.k,
dx / view.k
], [
(cx - view1.x) / view1.k,
(cy - view1.y) / view1.k,
dx / view1.k
]);
return function (t) {
var l = i(t), k = dx / l[2];
this.__chart__ = view = {
x: cx - l[0] * k,
y: cy - l[1] * k,
k: k
};
zoomed(dispatch);
};
}).each('interrupt.zoom', function () {
zoomended(dispatch);
}).each('end.zoom', function () {
zoomended(dispatch);
});
} else {
this.__chart__ = view;
zoomstarted(dispatch);
zoomed(dispatch);
zoomended(dispatch);
}
});
};
zoom.translate = function (_) {
if (!arguments.length)
return [
view.x,
view.y
];
view = {
x: +_[0],
y: +_[1],
k: view.k
};
rescale();
return zoom;
};
zoom.scale = function (_) {
if (!arguments.length)
return view.k;
view = {
x: view.x,
y: view.y,
k: null
};
scaleTo(+_);
rescale();
return zoom;
};
zoom.scaleExtent = function (_) {
if (!arguments.length)
return scaleExtent;
scaleExtent = _ == null ? d3_behavior_zoomInfinity : [
+_[0],
+_[1]
];
return zoom;
};
zoom.center = function (_) {
if (!arguments.length)
return center;
center = _ && [
+_[0],
+_[1]
];
return zoom;
};
zoom.size = function (_) {
if (!arguments.length)
return size;
size = _ && [
+_[0],
+_[1]
];
return zoom;
};
zoom.duration = function (_) {
if (!arguments.length)
return duration;
duration = +_;
return zoom;
};
zoom.x = function (z) {
if (!arguments.length)
return x1;
x1 = z;
x0 = z.copy();
view = {
x: 0,
y: 0,
k: 1
};
return zoom;
};
zoom.y = function (z) {
if (!arguments.length)
return y1;
y1 = z;
y0 = z.copy();
view = {
x: 0,
y: 0,
k: 1
};
return zoom;
};
function location(p) {
return [
(p[0] - view.x) / view.k,
(p[1] - view.y) / view.k
];
}
function point(l) {
return [
l[0] * view.k + view.x,
l[1] * view.k + view.y
];
}
function scaleTo(s) {
view.k = Math.max(scaleExtent[0], Math.min(scaleExtent[1], s));
}
function translateTo(p, l) {
l = point(l);
view.x += p[0] - l[0];
view.y += p[1] - l[1];
}
function zoomTo(that, p, l, k) {
that.__chart__ = {
x: view.x,
y: view.y,
k: view.k
};
scaleTo(Math.pow(2, k));
translateTo(center0 = p, l);
that = d3.select(that);
if (duration > 0)
that = that.transition().duration(duration);
that.call(zoom.event);
}
function rescale() {
if (x1)
x1.domain(x0.range().map(function (x) {
return (x - view.x) / view.k;
}).map(x0.invert));
if (y1)
y1.domain(y0.range().map(function (y) {
return (y - view.y) / view.k;
}).map(y0.invert));
}
function zoomstarted(dispatch) {
if (!zooming++)
dispatch({ type: 'zoomstart' });
}
function zoomed(dispatch) {
rescale();
dispatch({
type: 'zoom',
scale: view.k,
translate: [
view.x,
view.y
]
});
}
function zoomended(dispatch) {
if (!--zooming)
dispatch({ type: 'zoomend' }), center0 = null;
}
function mousedowned() {
var that = this, dispatch = event.of(that, arguments), dragged = 0, subject = d3.select(d3_window(that)).on(mousemove, moved).on(mouseup, ended), location0 = location(d3.mouse(that)), dragRestore = d3_event_dragSuppress(that);
d3_selection_interrupt.call(that);
zoomstarted(dispatch);
function moved() {
dragged = 1;
translateTo(d3.mouse(that), location0);
zoomed(dispatch);
}
function ended() {
subject.on(mousemove, null).on(mouseup, null);
dragRestore(dragged);
zoomended(dispatch);
}
}
function touchstarted() {
var that = this, dispatch = event.of(that, arguments), locations0 = {}, distance0 = 0, scale0, zoomName = '.zoom-' + d3.event.changedTouches[0].identifier, touchmove = 'touchmove' + zoomName, touchend = 'touchend' + zoomName, targets = [], subject = d3.select(that), dragRestore = d3_event_dragSuppress(that);
started();
zoomstarted(dispatch);
subject.on(mousedown, null).on(touchstart, started);
function relocate() {
var touches = d3.touches(that);
scale0 = view.k;
touches.forEach(function (t) {
if (t.identifier in locations0)
locations0[t.identifier] = location(t);
});
return touches;
}
function started() {
var target = d3.event.target;
d3.select(target).on(touchmove, moved).on(touchend, ended);
targets.push(target);
var changed = d3.event.changedTouches;
for (var i = 0, n = changed.length; i < n; ++i) {
locations0[changed[i].identifier] = null;
}
var touches = relocate(), now = Date.now();
if (touches.length === 1) {
if (now - touchtime < 500) {
var p = touches[0];
zoomTo(that, p, locations0[p.identifier], Math.floor(Math.log(view.k) / Math.LN2) + 1);
d3_eventPreventDefault();
}
touchtime = now;
} else if (touches.length > 1) {
var p = touches[0], q = touches[1], dx = p[0] - q[0], dy = p[1] - q[1];
distance0 = dx * dx + dy * dy;
}
}
function moved() {
var touches = d3.touches(that), p0, l0, p1, l1;
d3_selection_interrupt.call(that);
for (var i = 0, n = touches.length; i < n; ++i, l1 = null) {
p1 = touches[i];
if (l1 = locations0[p1.identifier]) {
if (l0)
break;
p0 = p1, l0 = l1;
}
}
if (l1) {
var distance1 = (distance1 = p1[0] - p0[0]) * distance1 + (distance1 = p1[1] - p0[1]) * distance1, scale1 = distance0 && Math.sqrt(distance1 / distance0);
p0 = [
(p0[0] + p1[0]) / 2,
(p0[1] + p1[1]) / 2
];
l0 = [
(l0[0] + l1[0]) / 2,
(l0[1] + l1[1]) / 2
];
scaleTo(scale1 * scale0);
}
touchtime = null;
translateTo(p0, l0);
zoomed(dispatch);
}
function ended() {
if (d3.event.touches.length) {
var changed = d3.event.changedTouches;
for (var i = 0, n = changed.length; i < n; ++i) {
delete locations0[changed[i].identifier];
}
for (var identifier in locations0) {
return void relocate();
}
}
d3.selectAll(targets).on(zoomName, null);
subject.on(mousedown, mousedowned).on(touchstart, touchstarted);
dragRestore();
zoomended(dispatch);
}
}
function mousewheeled() {
var dispatch = event.of(this, arguments);
if (mousewheelTimer)
clearTimeout(mousewheelTimer);
else
d3_selection_interrupt.call(this), translate0 = location(center0 = center || d3.mouse(this)), zoomstarted(dispatch);
mousewheelTimer = setTimeout(function () {
mousewheelTimer = null;
zoomended(dispatch);
}, 50);
d3_eventPreventDefault();
scaleTo(Math.pow(2, d3_behavior_zoomDelta() * 0.002) * view.k);
translateTo(center0, translate0);
zoomed(dispatch);
}
function dblclicked() {
var p = d3.mouse(this), k = Math.log(view.k) / Math.LN2;
zoomTo(this, p, location(p), d3.event.shiftKey ? Math.ceil(k) - 1 : Math.floor(k) + 1);
}
return d3.rebind(zoom, event, 'on');
};
var d3_behavior_zoomInfinity = [
0,
Infinity
], d3_behavior_zoomDelta, d3_behavior_zoomWheel;
d3.color = d3_color;
function d3_color() {
}
d3_color.prototype.toString = function () {
return this.rgb() + '';
};
d3.hsl = d3_hsl;
function d3_hsl(h, s, l) {
return this instanceof d3_hsl ? void (this.h = +h, this.s = +s, this.l = +l) : arguments.length < 2 ? h instanceof d3_hsl ? new d3_hsl(h.h, h.s, h.l) : d3_rgb_parse('' + h, d3_rgb_hsl, d3_hsl) : new d3_hsl(h, s, l);
}
var d3_hslPrototype = d3_hsl.prototype = new d3_color();
d3_hslPrototype.brighter = function (k) {
k = Math.pow(0.7, arguments.length ? k : 1);
return new d3_hsl(this.h, this.s, this.l / k);
};
d3_hslPrototype.darker = function (k) {
k = Math.pow(0.7, arguments.length ? k : 1);
return new d3_hsl(this.h, this.s, k * this.l);
};
d3_hslPrototype.rgb = function () {
return d3_hsl_rgb(this.h, this.s, this.l);
};
function d3_hsl_rgb(h, s, l) {
var m1, m2;
h = isNaN(h) ? 0 : (h %= 360) < 0 ? h + 360 : h;
s = isNaN(s) ? 0 : s < 0 ? 0 : s > 1 ? 1 : s;
l = l < 0 ? 0 : l > 1 ? 1 : l;
m2 = l <= 0.5 ? l * (1 + s) : l + s - l * s;
m1 = 2 * l - m2;
function v(h) {
if (h > 360)
h -= 360;
else if (h < 0)
h += 360;
if (h < 60)
return m1 + (m2 - m1) * h / 60;
if (h < 180)
return m2;
if (h < 240)
return m1 + (m2 - m1) * (240 - h) / 60;
return m1;
}
function vv(h) {
return Math.round(v(h) * 255);
}
return new d3_rgb(vv(h + 120), vv(h), vv(h - 120));
}
d3.hcl = d3_hcl;
function d3_hcl(h, c, l) {
return this instanceof d3_hcl ? void (this.h = +h, this.c = +c, this.l = +l) : arguments.length < 2 ? h instanceof d3_hcl ? new d3_hcl(h.h, h.c, h.l) : h instanceof d3_lab ? d3_lab_hcl(h.l, h.a, h.b) : d3_lab_hcl((h = d3_rgb_lab((h = d3.rgb(h)).r, h.g, h.b)).l, h.a, h.b) : new d3_hcl(h, c, l);
}
var d3_hclPrototype = d3_hcl.prototype = new d3_color();
d3_hclPrototype.brighter = function (k) {
return new d3_hcl(this.h, this.c, Math.min(100, this.l + d3_lab_K * (arguments.length ? k : 1)));
};
d3_hclPrototype.darker = function (k) {
return new d3_hcl(this.h, this.c, Math.max(0, this.l - d3_lab_K * (arguments.length ? k : 1)));
};
d3_hclPrototype.rgb = function () {
return d3_hcl_lab(this.h, this.c, this.l).rgb();
};
function d3_hcl_lab(h, c, l) {
if (isNaN(h))
h = 0;
if (isNaN(c))
c = 0;
return new d3_lab(l, Math.cos(h *= d3_radians) * c, Math.sin(h) * c);
}
d3.lab = d3_lab;
function d3_lab(l, a, b) {
return this instanceof d3_lab ? void (this.l = +l, this.a = +a, this.b = +b) : arguments.length < 2 ? l instanceof d3_lab ? new d3_lab(l.l, l.a, l.b) : l instanceof d3_hcl ? d3_hcl_lab(l.h, l.c, l.l) : d3_rgb_lab((l = d3_rgb(l)).r, l.g, l.b) : new d3_lab(l, a, b);
}
var d3_lab_K = 18;
var d3_lab_X = 0.95047, d3_lab_Y = 1, d3_lab_Z = 1.08883;
var d3_labPrototype = d3_lab.prototype = new d3_color();
d3_labPrototype.brighter = function (k) {
return new d3_lab(Math.min(100, this.l + d3_lab_K * (arguments.length ? k : 1)), this.a, this.b);
};
d3_labPrototype.darker = function (k) {
return new d3_lab(Math.max(0, this.l - d3_lab_K * (arguments.length ? k : 1)), this.a, this.b);
};
d3_labPrototype.rgb = function () {
return d3_lab_rgb(this.l, this.a, this.b);
};
function d3_lab_rgb(l, a, b) {
var y = (l + 16) / 116, x = y + a / 500, z = y - b / 200;
x = d3_lab_xyz(x) * d3_lab_X;
y = d3_lab_xyz(y) * d3_lab_Y;
z = d3_lab_xyz(z) * d3_lab_Z;
return new d3_rgb(d3_xyz_rgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z), d3_xyz_rgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z), d3_xyz_rgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z));
}
function d3_lab_hcl(l, a, b) {
return l > 0 ? new d3_hcl(Math.atan2(b, a) * d3_degrees, Math.sqrt(a * a + b * b), l) : new d3_hcl(NaN, NaN, l);
}
function d3_lab_xyz(x) {
return x > 0.206893034 ? x * x * x : (x - 4 / 29) / 7.787037;
}
function d3_xyz_lab(x) {
return x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787037 * x + 4 / 29;
}
function d3_xyz_rgb(r) {
return Math.round(255 * (r <= 0.00304 ? 12.92 * r : 1.055 * Math.pow(r, 1 / 2.4) - 0.055));
}
d3.rgb = d3_rgb;
function d3_rgb(r, g, b) {
return this instanceof d3_rgb ? void (this.r = ~~r, this.g = ~~g, this.b = ~~b) : arguments.length < 2 ? r instanceof d3_rgb ? new d3_rgb(r.r, r.g, r.b) : d3_rgb_parse('' + r, d3_rgb, d3_hsl_rgb) : new d3_rgb(r, g, b);
}
function d3_rgbNumber(value) {
return new d3_rgb(value >> 16, value >> 8 & 255, value & 255);
}
function d3_rgbString(value) {
return d3_rgbNumber(value) + '';
}
var d3_rgbPrototype = d3_rgb.prototype = new d3_color();
d3_rgbPrototype.brighter = function (k) {
k = Math.pow(0.7, arguments.length ? k : 1);
var r = this.r, g = this.g, b = this.b, i = 30;
if (!r && !g && !b)
return new d3_rgb(i, i, i);
if (r && r < i)
r = i;
if (g && g < i)
g = i;
if (b && b < i)
b = i;
return new d3_rgb(Math.min(255, r / k), Math.min(255, g / k), Math.min(255, b / k));
};
d3_rgbPrototype.darker = function (k) {
k = Math.pow(0.7, arguments.length ? k : 1);
return new d3_rgb(k * this.r, k * this.g, k * this.b);
};
d3_rgbPrototype.hsl = function () {
return d3_rgb_hsl(this.r, this.g, this.b);
};
d3_rgbPrototype.toString = function () {
return '#' + d3_rgb_hex(this.r) + d3_rgb_hex(this.g) + d3_rgb_hex(this.b);
};
function d3_rgb_hex(v) {
return v < 16 ? '0' + Math.max(0, v).toString(16) : Math.min(255, v).toString(16);
}
function d3_rgb_parse(format, rgb, hsl) {
var r = 0, g = 0, b = 0, m1, m2, color;
m1 = /([a-z]+)\((.*)\)/.exec(format = format.toLowerCase());
if (m1) {
m2 = m1[2].split(',');
switch (m1[1]) {
case 'hsl': {
return hsl(parseFloat(m2[0]), parseFloat(m2[1]) / 100, parseFloat(m2[2]) / 100);
}
case 'rgb': {
return rgb(d3_rgb_parseNumber(m2[0]), d3_rgb_parseNumber(m2[1]), d3_rgb_parseNumber(m2[2]));
}
}
}
if (color = d3_rgb_names.get(format)) {
return rgb(color.r, color.g, color.b);
}
if (format != null && format.charAt(0) === '#' && !isNaN(color = parseInt(format.slice(1), 16))) {
if (format.length === 4) {
r = (color & 3840) >> 4;
r = r >> 4 | r;
g = color & 240;
g = g >> 4 | g;
b = color & 15;
b = b << 4 | b;
} else if (format.length === 7) {
r = (color & 16711680) >> 16;
g = (color & 65280) >> 8;
b = color & 255;
}
}
return rgb(r, g, b);
}
function d3_rgb_hsl(r, g, b) {
var min = Math.min(r /= 255, g /= 255, b /= 255), max = Math.max(r, g, b), d = max - min, h, s, l = (max + min) / 2;
if (d) {
s = l < 0.5 ? d / (max + min) : d / (2 - max - min);
if (r == max)
h = (g - b) / d + (g < b ? 6 : 0);
else if (g == max)
h = (b - r) / d + 2;
else
h = (r - g) / d + 4;
h *= 60;
} else {
h = NaN;
s = l > 0 && l < 1 ? 0 : h;
}
return new d3_hsl(h, s, l);
}
function d3_rgb_lab(r, g, b) {
r = d3_rgb_xyz(r);
g = d3_rgb_xyz(g);
b = d3_rgb_xyz(b);
var x = d3_xyz_lab((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / d3_lab_X), y = d3_xyz_lab((0.2126729 * r + 0.7151522 * g + 0.072175 * b) / d3_lab_Y), z = d3_xyz_lab((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / d3_lab_Z);
return d3_lab(116 * y - 16, 500 * (x - y), 200 * (y - z));
}
function d3_rgb_xyz(r) {
return (r /= 255) <= 0.04045 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
}
function d3_rgb_parseNumber(c) {
var f = parseFloat(c);
return c.charAt(c.length - 1) === '%' ? Math.round(f * 2.55) : f;
}
var d3_rgb_names = d3.map({
aliceblue: 15792383,
antiquewhite: 16444375,
aqua: 65535,
aquamarine: 8388564,
azure: 15794175,
beige: 16119260,
bisque: 16770244,
black: 0,
blanchedalmond: 16772045,
blue: 255,
blueviolet: 9055202,
brown: 10824234,
burlywood: 14596231,
cadetblue: 6266528,
chartreuse: 8388352,
chocolate: 13789470,
coral: 16744272,
cornflowerblue: 6591981,
cornsilk: 16775388,
crimson: 14423100,
cyan: 65535,
darkblue: 139,
darkcyan: 35723,
darkgoldenrod: 12092939,
darkgray: 11119017,
darkgreen: 25600,
darkgrey: 11119017,
darkkhaki: 12433259,
darkmagenta: 9109643,
darkolivegreen: 5597999,
darkorange: 16747520,
darkorchid: 10040012,
darkred: 9109504,
darksalmon: 15308410,
darkseagreen: 9419919,
darkslateblue: 4734347,
darkslategray: 3100495,
darkslategrey: 3100495,
darkturquoise: 52945,
darkviolet: 9699539,
deeppink: 16716947,
deepskyblue: 49151,
dimgray: 6908265,
dimgrey: 6908265,
dodgerblue: 2003199,
firebrick: 11674146,
floralwhite: 16775920,
forestgreen: 2263842,
fuchsia: 16711935,
gainsboro: 14474460,
ghostwhite: 16316671,
gold: 16766720,
goldenrod: 14329120,
gray: 8421504,
green: 32768,
greenyellow: 11403055,
grey: 8421504,
honeydew: 15794160,
hotpink: 16738740,
indianred: 13458524,
indigo: 4915330,
ivory: 16777200,
khaki: 15787660,
lavender: 15132410,
lavenderblush: 16773365,
lawngreen: 8190976,
lemonchiffon: 16775885,
lightblue: 11393254,
lightcoral: 15761536,
lightcyan: 14745599,
lightgoldenrodyellow: 16448210,
lightgray: 13882323,
lightgreen: 9498256,
lightgrey: 13882323,
lightpink: 16758465,
lightsalmon: 16752762,
lightseagreen: 2142890,
lightskyblue: 8900346,
lightslategray: 7833753,
lightslategrey: 7833753,
lightsteelblue: 11584734,
lightyellow: 16777184,
lime: 65280,
limegreen: 3329330,
linen: 16445670,
magenta: 16711935,
maroon: 8388608,
mediumaquamarine: 6737322,
mediumblue: 205,
mediumorchid: 12211667,
mediumpurple: 9662683,
mediumseagreen: 3978097,
mediumslateblue: 8087790,
mediumspringgreen: 64154,
mediumturquoise: 4772300,
mediumvioletred: 13047173,
midnightblue: 1644912,
mintcream: 16121850,
mistyrose: 16770273,
moccasin: 16770229,
navajowhite: 16768685,
navy: 128,
oldlace: 16643558,
olive: 8421376,
olivedrab: 7048739,
orange: 16753920,
orangered: 16729344,
orchid: 14315734,
palegoldenrod: 15657130,
palegreen: 10025880,
paleturquoise: 11529966,
palevioletred: 14381203,
papayawhip: 16773077,
peachpuff: 16767673,
peru: 13468991,
pink: 16761035,
plum: 14524637,
powderblue: 11591910,
purple: 8388736,
rebeccapurple: 6697881,
red: 16711680,
rosybrown: 12357519,
royalblue: 4286945,
saddlebrown: 9127187,
salmon: 16416882,
sandybrown: 16032864,
seagreen: 3050327,
seashell: 16774638,
sienna: 10506797,
silver: 12632256,
skyblue: 8900331,
slateblue: 6970061,
slategray: 7372944,
slategrey: 7372944,
snow: 16775930,
springgreen: 65407,
steelblue: 4620980,
tan: 13808780,
teal: 32896,
thistle: 14204888,
tomato: 16737095,
turquoise: 4251856,
violet: 15631086,
wheat: 16113331,
white: 16777215,
whitesmoke: 16119285,
yellow: 16776960,
yellowgreen: 10145074
});
d3_rgb_names.forEach(function (key, value) {
d3_rgb_names.set(key, d3_rgbNumber(value));
});
function d3_functor(v) {
return typeof v === 'function' ? v : function () {
return v;
};
}
d3.functor = d3_functor;
d3.xhr = d3_xhrType(d3_identity);
function d3_xhrType(response) {
return function (url, mimeType, callback) {
if (arguments.length === 2 && typeof mimeType === 'function')
callback = mimeType, mimeType = null;
return d3_xhr(url, mimeType, response, callback);
};
}
function d3_xhr(url, mimeType, response, callback) {
var xhr = {}, dispatch = d3.dispatch('beforesend', 'progress', 'load', 'error'), headers = {}, request = new XMLHttpRequest(), responseType = null;
if (this.XDomainRequest && !('withCredentials' in request) && /^(http(s)?:)?\/\//.test(url))
request = new XDomainRequest();
'onload' in request ? request.onload = request.onerror = respond : request.onreadystatechange = function () {
request.readyState > 3 && respond();
};
function respond() {
var status = request.status, result;
if (!status && d3_xhrHasResponse(request) || status >= 200 && status < 300 || status === 304) {
try {
result = response.call(xhr, request);
} catch (e) {
dispatch.error.call(xhr, e);
return;
}
dispatch.load.call(xhr, result);
} else {
dispatch.error.call(xhr, request);
}
}
request.onprogress = function (event) {
var o = d3.event;
d3.event = event;
try {
dispatch.progress.call(xhr, request);
} finally {
d3.event = o;
}
};
xhr.header = function (name, value) {
name = (name + '').toLowerCase();
if (arguments.length < 2)
return headers[name];
if (value == null)
delete headers[name];
else
headers[name] = value + '';
return xhr;
};
xhr.mimeType = function (value) {
if (!arguments.length)
return mimeType;
mimeType = value == null ? null : value + '';
return xhr;
};
xhr.responseType = function (value) {
if (!arguments.length)
return responseType;
responseType = value;
return xhr;
};
xhr.response = function (value) {
response = value;
return xhr;
};
[
'get',
'post'
].forEach(function (method) {
xhr[method] = function () {
return xhr.send.apply(xhr, [method].concat(d3_array(arguments)));
};
});
xhr.send = function (method, data, callback) {
if (arguments.length === 2 && typeof data === 'function')
callback = data, data = null;
request.open(method, url, true);
if (mimeType != null && !('accept' in headers))
headers['accept'] = mimeType + ',*/*';
if (request.setRequestHeader)
for (var name in headers)
request.setRequestHeader(name, headers[name]);
if (mimeType != null && request.overrideMimeType)
request.overrideMimeType(mimeType);
if (responseType != null)
request.responseType = responseType;
if (callback != null)
xhr.on('error', callback).on('load', function (request) {
callback(null, request);
});
dispatch.beforesend.call(xhr, request);
request.send(data == null ? null : data);
return xhr;
};
xhr.abort = function () {
request.abort();
return xhr;
};
d3.rebind(xhr, dispatch, 'on');
return callback == null ? xhr : xhr.get(d3_xhr_fixCallback(callback));
}
function d3_xhr_fixCallback(callback) {
return callback.length === 1 ? function (error, request) {
callback(error == null ? request : null);
} : callback;
}
function d3_xhrHasResponse(request) {
var type = request.responseType;
return type && type !== 'text' ? request.response : request.responseText;
}
d3.dsv = function (delimiter, mimeType) {
var reFormat = new RegExp('["' + delimiter + '\n]'), delimiterCode = delimiter.charCodeAt(0);
function dsv(url, row, callback) {
if (arguments.length < 3)
callback = row, row = null;
var xhr = d3_xhr(url, mimeType, row == null ? response : typedResponse(row), callback);
xhr.row = function (_) {
return arguments.length ? xhr.response((row = _) == null ? response : typedResponse(_)) : row;
};
return xhr;
}
function response(request) {
return dsv.parse(request.responseText);
}
function typedResponse(f) {
return function (request) {
return dsv.parse(request.responseText, f);
};
}
dsv.parse = function (text, f) {
var o;
return dsv.parseRows(text, function (row, i) {
if (o)
return o(row, i - 1);
var a = new Function('d', 'return {' + row.map(function (name, i) {
return JSON.stringify(name) + ': d[' + i + ']';
}).join(',') + '}');
o = f ? function (row, i) {
return f(a(row), i);
} : a;
});
};
dsv.parseRows = function (text, f) {
var EOL = {}, EOF = {}, rows = [], N = text.length, I = 0, n = 0, t, eol;
function token() {
if (I >= N)
return EOF;
if (eol)
return eol = false, EOL;
var j = I;
if (text.charCodeAt(j) === 34) {
var i = j;
while (i++ < N) {
if (text.charCodeAt(i) === 34) {
if (text.charCodeAt(i + 1) !== 34)
break;
++i;
}
}
I = i + 2;
var c = text.charCodeAt(i + 1);
if (c === 13) {
eol = true;
if (text.charCodeAt(i + 2) === 10)
++I;
} else if (c === 10) {
eol = true;
}
return text.slice(j + 1, i).replace(/""/g, '"');
}
while (I < N) {
var c = text.charCodeAt(I++), k = 1;
if (c === 10)
eol = true;
else if (c === 13) {
eol = true;
if (text.charCodeAt(I) === 10)
++I, ++k;
} else if (c !== delimiterCode)
continue;
return text.slice(j, I - k);
}
return text.slice(j);
}
while ((t = token()) !== EOF) {
var a = [];
while (t !== EOL && t !== EOF) {
a.push(t);
t = token();
}
if (f && (a = f(a, n++)) == null)
continue;
rows.push(a);
}
return rows;
};
dsv.format = function (rows) {
if (Array.isArray(rows[0]))
return dsv.formatRows(rows);
var fieldSet = new d3_Set(), fields = [];
rows.forEach(function (row) {
for (var field in row) {
if (!fieldSet.has(field)) {
fields.push(fieldSet.add(field));
}
}
});
return [fields.map(formatValue).join(delimiter)].concat(rows.map(function (row) {
return fields.map(function (field) {
return formatValue(row[field]);
}).join(delimiter);
})).join('\n');
};
dsv.formatRows = function (rows) {
return rows.map(formatRow).join('\n');
};
function formatRow(row) {
return row.map(formatValue).join(delimiter);
}
function formatValue(text) {
return reFormat.test(text) ? '"' + text.replace(/\"/g, '""') + '"' : text;
}
return dsv;
};
d3.csv = d3.dsv(',', 'text/csv');
d3.tsv = d3.dsv('\t', 'text/tab-separated-values');
var d3_timer_queueHead, d3_timer_queueTail, d3_timer_interval, d3_timer_timeout, d3_timer_frame = this[d3_vendorSymbol(this, 'requestAnimationFrame')] || function (callback) {
setTimeout(callback, 17);
};
d3.timer = function () {
d3_timer.apply(this, arguments);
};
function d3_timer(callback, delay, then) {
var n = arguments.length;
if (n < 2)
delay = 0;
if (n < 3)
then = Date.now();
var time = then + delay, timer = {
c: callback,
t: time,
n: null
};
if (d3_timer_queueTail)
d3_timer_queueTail.n = timer;
else
d3_timer_queueHead = timer;
d3_timer_queueTail = timer;
if (!d3_timer_interval) {
d3_timer_timeout = clearTimeout(d3_timer_timeout);
d3_timer_interval = 1;
d3_timer_frame(d3_timer_step);
}
return timer;
}
function d3_timer_step() {
var now = d3_timer_mark(), delay = d3_timer_sweep() - now;
if (delay > 24) {
if (isFinite(delay)) {
clearTimeout(d3_timer_timeout);
d3_timer_timeout = setTimeout(d3_timer_step, delay);
}
d3_timer_interval = 0;
} else {
d3_timer_interval = 1;
d3_timer_frame(d3_timer_step);
}
}
d3.timer.flush = function () {
d3_timer_mark();
d3_timer_sweep();
};
function d3_timer_mark() {
var now = Date.now(), timer = d3_timer_queueHead;
while (timer) {
if (now >= timer.t && timer.c(now - timer.t))
timer.c = null;
timer = timer.n;
}
return now;
}
function d3_timer_sweep() {
var t0, t1 = d3_timer_queueHead, time = Infinity;
while (t1) {
if (t1.c) {
if (t1.t < time)
time = t1.t;
t1 = (t0 = t1).n;
} else {
t1 = t0 ? t0.n = t1.n : d3_timer_queueHead = t1.n;
}
}
d3_timer_queueTail = t0;
return time;
}
function d3_format_precision(x, p) {
return p - (x ? Math.ceil(Math.log(x) / Math.LN10) : 1);
}
d3.round = function (x, n) {
return n ? Math.round(x * (n = Math.pow(10, n))) / n : Math.round(x);
};
var d3_formatPrefixes = [
'y',
'z',
'a',
'f',
'p',
'n',
'µ',
'm',
'',
'k',
'M',
'G',
'T',
'P',
'E',
'Z',
'Y'
].map(d3_formatPrefix);
d3.formatPrefix = function (value, precision) {
var i = 0;
if (value = +value) {
if (value < 0)
value *= -1;
if (precision)
value = d3.round(value, d3_format_precision(value, precision));
i = 1 + Math.floor(1e-12 + Math.log(value) / Math.LN10);
i = Math.max(-24, Math.min(24, Math.floor((i - 1) / 3) * 3));
}
return d3_formatPrefixes[8 + i / 3];
};
function d3_formatPrefix(d, i) {
var k = Math.pow(10, abs(8 - i) * 3);
return {
scale: i > 8 ? function (d) {
return d / k;
} : function (d) {
return d * k;
},
symbol: d
};
}
function d3_locale_numberFormat(locale) {
var locale_decimal = locale.decimal, locale_thousands = locale.thousands, locale_grouping = locale.grouping, locale_currency = locale.currency, formatGroup = locale_grouping && locale_thousands ? function (value, width) {
var i = value.length, t = [], j = 0, g = locale_grouping[0], length = 0;
while (i > 0 && g > 0) {
if (length + g + 1 > width)
g = Math.max(1, width - length);
t.push(value.substring(i -= g, i + g));
if ((length += g + 1) > width)
break;
g = locale_grouping[j = (j + 1) % locale_grouping.length];
}
return t.reverse().join(locale_thousands);
} : d3_identity;
return function (specifier) {
var match = d3_format_re.exec(specifier), fill = match[1] || ' ', align = match[2] || '>', sign = match[3] || '-', symbol = match[4] || '', zfill = match[5], width = +match[6], comma = match[7], precision = match[8], type = match[9], scale = 1, prefix = '', suffix = '', integer = false, exponent = true;
if (precision)
precision = +precision.substring(1);
if (zfill || fill === '0' && align === '=') {
zfill = fill = '0';
align = '=';
}
switch (type) {
case 'n':
comma = true;
type = 'g';
break;
case '%':
scale = 100;
suffix = '%';
type = 'f';
break;
case 'p':
scale = 100;
suffix = '%';
type = 'r';
break;
case 'b':
case 'o':
case 'x':
case 'X':
if (symbol === '#')
prefix = '0' + type.toLowerCase();
case 'c':
exponent = false;
case 'd':
integer = true;
precision = 0;
break;
case 's':
scale = -1;
type = 'r';
break;
}
if (symbol === '$')
prefix = locale_currency[0], suffix = locale_currency[1];
if (type == 'r' && !precision)
type = 'g';
if (precision != null) {
if (type == 'g')
precision = Math.max(1, Math.min(21, precision));
else if (type == 'e' || type == 'f')
precision = Math.max(0, Math.min(20, precision));
}
type = d3_format_types.get(type) || d3_format_typeDefault;
var zcomma = zfill && comma;
return function (value) {
var fullSuffix = suffix;
if (integer && value % 1)
return '';
var negative = value < 0 || value === 0 && 1 / value < 0 ? (value = -value, '-') : sign === '-' ? '' : sign;
if (scale < 0) {
var unit = d3.formatPrefix(value, precision);
value = unit.scale(value);
fullSuffix = unit.symbol + suffix;
} else {
value *= scale;
}
value = type(value, precision);
var i = value.lastIndexOf('.'), before, after;
if (i < 0) {
var j = exponent ? value.lastIndexOf('e') : -1;
if (j < 0)
before = value, after = '';
else
before = value.substring(0, j), after = value.substring(j);
} else {
before = value.substring(0, i);
after = locale_decimal + value.substring(i + 1);
}
if (!zfill && comma)
before = formatGroup(before, Infinity);
var length = prefix.length + before.length + after.length + (zcomma ? 0 : negative.length), padding = length < width ? new Array(length = width - length + 1).join(fill) : '';
if (zcomma)
before = formatGroup(padding + before, padding.length ? width - after.length : Infinity);
negative += prefix;
value = before + after;
return (align === '<' ? negative + value + padding : align === '>' ? padding + negative + value : align === '^' ? padding.substring(0, length >>= 1) + negative + value + padding.substring(length) : negative + (zcomma ? value : padding + value)) + fullSuffix;
};
};
}
var d3_format_re = /(?:([^{])?([<>=^]))?([+\- ])?([$#])?(0)?(\d+)?(,)?(\.-?\d+)?([a-z%])?/i;
var d3_format_types = d3.map({
b: function (x) {
return x.toString(2);
},
c: function (x) {
return String.fromCharCode(x);
},
o: function (x) {
return x.toString(8);
},
x: function (x) {
return x.toString(16);
},
X: function (x) {
return x.toString(16).toUpperCase();
},
g: function (x, p) {
return x.toPrecision(p);
},
e: function (x, p) {
return x.toExponential(p);
},
f: function (x, p) {
return x.toFixed(p);
},
r: function (x, p) {
return (x = d3.round(x, d3_format_precision(x, p))).toFixed(Math.max(0, Math.min(20, d3_format_precision(x * (1 + 1e-15), p))));
}
});
function d3_format_typeDefault(x) {
return x + '';
}
var d3_time = d3.time = {}, d3_date = Date;
function d3_date_utc() {
this._ = new Date(arguments.length > 1 ? Date.UTC.apply(this, arguments) : arguments[0]);
}
d3_date_utc.prototype = {
getDate: function () {
return this._.getUTCDate();
},
getDay: function () {
return this._.getUTCDay();
},
getFullYear: function () {
return this._.getUTCFullYear();
},
getHours: function () {
return this._.getUTCHours();
},
getMilliseconds: function () {
return this._.getUTCMilliseconds();
},
getMinutes: function () {
return this._.getUTCMinutes();
},
getMonth: function () {
return this._.getUTCMonth();
},
getSeconds: function () {
return this._.getUTCSeconds();
},
getTime: function () {
return this._.getTime();
},
getTimezoneOffset: function () {
return 0;
},
valueOf: function () {
return this._.valueOf();
},
setDate: function () {
d3_time_prototype.setUTCDate.apply(this._, arguments);
},
setDay: function () {
d3_time_prototype.setUTCDay.apply(this._, arguments);
},
setFullYear: function () {
d3_time_prototype.setUTCFullYear.apply(this._, arguments);
},
setHours: function () {
d3_time_prototype.setUTCHours.apply(this._, arguments);
},
setMilliseconds: function () {
d3_time_prototype.setUTCMilliseconds.apply(this._, arguments);
},
setMinutes: function () {
d3_time_prototype.setUTCMinutes.apply(this._, arguments);
},
setMonth: function () {
d3_time_prototype.setUTCMonth.apply(this._, arguments);
},
setSeconds: function () {
d3_time_prototype.setUTCSeconds.apply(this._, arguments);
},
setTime: function () {
d3_time_prototype.setTime.apply(this._, arguments);
}
};
var d3_time_prototype = Date.prototype;
function d3_time_interval(local, step, number) {
function round(date) {
var d0 = local(date), d1 = offset(d0, 1);
return date - d0 < d1 - date ? d0 : d1;
}
function ceil(date) {
step(date = local(new d3_date(date - 1)), 1);
return date;
}
function offset(date, k) {
step(date = new d3_date(+date), k);
return date;
}
function range(t0, t1, dt) {
var time = ceil(t0), times = [];
if (dt > 1) {
while (time < t1) {
if (!(number(time) % dt))
times.push(new Date(+time));
step(time, 1);
}
} else {
while (time < t1)
times.push(new Date(+time)), step(time, 1);
}
return times;
}
function range_utc(t0, t1, dt) {
try {
d3_date = d3_date_utc;
var utc = new d3_date_utc();
utc._ = t0;
return range(utc, t1, dt);
} finally {
d3_date = Date;
}
}
local.floor = local;
local.round = round;
local.ceil = ceil;
local.offset = offset;
local.range = range;
var utc = local.utc = d3_time_interval_utc(local);
utc.floor = utc;
utc.round = d3_time_interval_utc(round);
utc.ceil = d3_time_interval_utc(ceil);
utc.offset = d3_time_interval_utc(offset);
utc.range = range_utc;
return local;
}
function d3_time_interval_utc(method) {
return function (date, k) {
try {
d3_date = d3_date_utc;
var utc = new d3_date_utc();
utc._ = date;
return method(utc, k)._;
} finally {
d3_date = Date;
}
};
}
d3_time.year = d3_time_interval(function (date) {
date = d3_time.day(date);
date.setMonth(0, 1);
return date;
}, function (date, offset) {
date.setFullYear(date.getFullYear() + offset);
}, function (date) {
return date.getFullYear();
});
d3_time.years = d3_time.year.range;
d3_time.years.utc = d3_time.year.utc.range;
d3_time.day = d3_time_interval(function (date) {
var day = new d3_date(2000, 0);
day.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
return day;
}, function (date, offset) {
date.setDate(date.getDate() + offset);
}, function (date) {
return date.getDate() - 1;
});
d3_time.days = d3_time.day.range;
d3_time.days.utc = d3_time.day.utc.range;
d3_time.dayOfYear = function (date) {
var year = d3_time.year(date);
return Math.floor((date - year - (date.getTimezoneOffset() - year.getTimezoneOffset()) * 60000) / 86400000);
};
[
'sunday',
'monday',
'tuesday',
'wednesday',
'thursday',
'friday',
'saturday'
].forEach(function (day, i) {
i = 7 - i;
var interval = d3_time[day] = d3_time_interval(function (date) {
(date = d3_time.day(date)).setDate(date.getDate() - (date.getDay() + i) % 7);
return date;
}, function (date, offset) {
date.setDate(date.getDate() + Math.floor(offset) * 7);
}, function (date) {
var day = d3_time.year(date).getDay();
return Math.floor((d3_time.dayOfYear(date) + (day + i) % 7) / 7) - (day !== i);
});
d3_time[day + 's'] = interval.range;
d3_time[day + 's'].utc = interval.utc.range;
d3_time[day + 'OfYear'] = function (date) {
var day = d3_time.year(date).getDay();
return Math.floor((d3_time.dayOfYear(date) + (day + i) % 7) / 7);
};
});
d3_time.week = d3_time.sunday;
d3_time.weeks = d3_time.sunday.range;
d3_time.weeks.utc = d3_time.sunday.utc.range;
d3_time.weekOfYear = d3_time.sundayOfYear;
function d3_locale_timeFormat(locale) {
var locale_dateTime = locale.dateTime, locale_date = locale.date, locale_time = locale.time, locale_periods = locale.periods, locale_days = locale.days, locale_shortDays = locale.shortDays, locale_months = locale.months, locale_shortMonths = locale.shortMonths;
function d3_time_format(template) {
var n = template.length;
function format(date) {
var string = [], i = -1, j = 0, c, p, f;
while (++i < n) {
if (template.charCodeAt(i) === 37) {
string.push(template.slice(j, i));
if ((p = d3_time_formatPads[c = template.charAt(++i)]) != null)
c = template.charAt(++i);
if (f = d3_time_formats[c])
c = f(date, p == null ? c === 'e' ? ' ' : '0' : p);
string.push(c);
j = i + 1;
}
}
string.push(template.slice(j, i));
return string.join('');
}
format.parse = function (string) {
var d = {
y: 1900,
m: 0,
d: 1,
H: 0,
M: 0,
S: 0,
L: 0,
Z: null
}, i = d3_time_parse(d, template, string, 0);
if (i != string.length)
return null;
if ('p' in d)
d.H = d.H % 12 + d.p * 12;
var localZ = d.Z != null && d3_date !== d3_date_utc, date = new (localZ ? d3_date_utc : d3_date)();
if ('j' in d)
date.setFullYear(d.y, 0, d.j);
else if ('W' in d || 'U' in d) {
if (!('w' in d))
d.w = 'W' in d ? 1 : 0;
date.setFullYear(d.y, 0, 1);
date.setFullYear(d.y, 0, 'W' in d ? (d.w + 6) % 7 + d.W * 7 - (date.getDay() + 5) % 7 : d.w + d.U * 7 - (date.getDay() + 6) % 7);
} else
date.setFullYear(d.y, d.m, d.d);
date.setHours(d.H + (d.Z / 100 | 0), d.M + d.Z % 100, d.S, d.L);
return localZ ? date._ : date;
};
format.toString = function () {
return template;
};
return format;
}
function d3_time_parse(date, template, string, j) {
var c, p, t, i = 0, n = template.length, m = string.length;
while (i < n) {
if (j >= m)
return -1;
c = template.charCodeAt(i++);
if (c === 37) {
t = template.charAt(i++);
p = d3_time_parsers[t in d3_time_formatPads ? template.charAt(i++) : t];
if (!p || (j = p(date, string, j)) < 0)
return -1;
} else if (c != string.charCodeAt(j++)) {
return -1;
}
}
return j;
}
d3_time_format.utc = function (template) {
var local = d3_time_format(template);
function format(date) {
try {
d3_date = d3_date_utc;
var utc = new d3_date();
utc._ = date;
return local(utc);
} finally {
d3_date = Date;
}
}
format.parse = function (string) {
try {
d3_date = d3_date_utc;
var date = local.parse(string);
return date && date._;
} finally {
d3_date = Date;
}
};
format.toString = local.toString;
return format;
};
d3_time_format.multi = d3_time_format.utc.multi = d3_time_formatMulti;
var d3_time_periodLookup = d3.map(), d3_time_dayRe = d3_time_formatRe(locale_days), d3_time_dayLookup = d3_time_formatLookup(locale_days), d3_time_dayAbbrevRe = d3_time_formatRe(locale_shortDays), d3_time_dayAbbrevLookup = d3_time_formatLookup(locale_shortDays), d3_time_monthRe = d3_time_formatRe(locale_months), d3_time_monthLookup = d3_time_formatLookup(locale_months), d3_time_monthAbbrevRe = d3_time_formatRe(locale_shortMonths), d3_time_monthAbbrevLookup = d3_time_formatLookup(locale_shortMonths);
locale_periods.forEach(function (p, i) {
d3_time_periodLookup.set(p.toLowerCase(), i);
});
var d3_time_formats = {
a: function (d) {
return locale_shortDays[d.getDay()];
},
A: function (d) {
return locale_days[d.getDay()];
},
b: function (d) {
return locale_shortMonths[d.getMonth()];
},
B: function (d) {
return locale_months[d.getMonth()];
},
c: d3_time_format(locale_dateTime),
d: function (d, p) {
return d3_time_formatPad(d.getDate(), p, 2);
},
e: function (d, p) {
return d3_time_formatPad(d.getDate(), p, 2);
},
H: function (d, p) {
return d3_time_formatPad(d.getHours(), p, 2);
},
I: function (d, p) {
return d3_time_formatPad(d.getHours() % 12 || 12, p, 2);
},
j: function (d, p) {
return d3_time_formatPad(1 + d3_time.dayOfYear(d), p, 3);
},
L: function (d, p) {
return d3_time_formatPad(d.getMilliseconds(), p, 3);
},
m: function (d, p) {
return d3_time_formatPad(d.getMonth() + 1, p, 2);
},
M: function (d, p) {
return d3_time_formatPad(d.getMinutes(), p, 2);
},
p: function (d) {
return locale_periods[+(d.getHours() >= 12)];
},
S: function (d, p) {
return d3_time_formatPad(d.getSeconds(), p, 2);
},
U: function (d, p) {
return d3_time_formatPad(d3_time.sundayOfYear(d), p, 2);
},
w: function (d) {
return d.getDay();
},
W: function (d, p) {
return d3_time_formatPad(d3_time.mondayOfYear(d), p, 2);
},
x: d3_time_format(locale_date),
X: d3_time_format(locale_time),
y: function (d, p) {
return d3_time_formatPad(d.getFullYear() % 100, p, 2);
},
Y: function (d, p) {
return d3_time_formatPad(d.getFullYear() % 10000, p, 4);
},
Z: d3_time_zone,
'%': function () {
return '%';
}
};
var d3_time_parsers = {
a: d3_time_parseWeekdayAbbrev,
A: d3_time_parseWeekday,
b: d3_time_parseMonthAbbrev,
B: d3_time_parseMonth,
c: d3_time_parseLocaleFull,
d: d3_time_parseDay,
e: d3_time_parseDay,
H: d3_time_parseHour24,
I: d3_time_parseHour24,
j: d3_time_parseDayOfYear,
L: d3_time_parseMilliseconds,
m: d3_time_parseMonthNumber,
M: d3_time_parseMinutes,
p: d3_time_parseAmPm,
S: d3_time_parseSeconds,
U: d3_time_parseWeekNumberSunday,
w: d3_time_parseWeekdayNumber,
W: d3_time_parseWeekNumberMonday,
x: d3_time_parseLocaleDate,
X: d3_time_parseLocaleTime,
y: d3_time_parseYear,
Y: d3_time_parseFullYear,
Z: d3_time_parseZone,
'%': d3_time_parseLiteralPercent
};
function d3_time_parseWeekdayAbbrev(date, string, i) {
d3_time_dayAbbrevRe.lastIndex = 0;
var n = d3_time_dayAbbrevRe.exec(string.slice(i));
return n ? (date.w = d3_time_dayAbbrevLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
}
function d3_time_parseWeekday(date, string, i) {
d3_time_dayRe.lastIndex = 0;
var n = d3_time_dayRe.exec(string.slice(i));
return n ? (date.w = d3_time_dayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
}
function d3_time_parseMonthAbbrev(date, string, i) {
d3_time_monthAbbrevRe.lastIndex = 0;
var n = d3_time_monthAbbrevRe.exec(string.slice(i));
return n ? (date.m = d3_time_monthAbbrevLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
}
function d3_time_parseMonth(date, string, i) {
d3_time_monthRe.lastIndex = 0;
var n = d3_time_monthRe.exec(string.slice(i));
return n ? (date.m = d3_time_monthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
}
function d3_time_parseLocaleFull(date, string, i) {
return d3_time_parse(date, d3_time_formats.c.toString(), string, i);
}
function d3_time_parseLocaleDate(date, string, i) {
return d3_time_parse(date, d3_time_formats.x.toString(), string, i);
}
function d3_time_parseLocaleTime(date, string, i) {
return d3_time_parse(date, d3_time_formats.X.toString(), string, i);
}
function d3_time_parseAmPm(date, string, i) {
var n = d3_time_periodLookup.get(string.slice(i, i += 2).toLowerCase());
return n == null ? -1 : (date.p = n, i);
}
return d3_time_format;
}
var d3_time_formatPads = {
'-': '',
_: ' ',
'0': '0'
}, d3_time_numberRe = /^\s*\d+/, d3_time_percentRe = /^%/;
function d3_time_formatPad(value, fill, width) {
var sign = value < 0 ? '-' : '', string = (sign ? -value : value) + '', length = string.length;
return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
}
function d3_time_formatRe(names) {
return new RegExp('^(?:' + names.map(d3.requote).join('|') + ')', 'i');
}
function d3_time_formatLookup(names) {
var map = new d3_Map(), i = -1, n = names.length;
while (++i < n)
map.set(names[i].toLowerCase(), i);
return map;
}
function d3_time_parseWeekdayNumber(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 1));
return n ? (date.w = +n[0], i + n[0].length) : -1;
}
function d3_time_parseWeekNumberSunday(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i));
return n ? (date.U = +n[0], i + n[0].length) : -1;
}
function d3_time_parseWeekNumberMonday(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i));
return n ? (date.W = +n[0], i + n[0].length) : -1;
}
function d3_time_parseFullYear(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 4));
return n ? (date.y = +n[0], i + n[0].length) : -1;
}
function d3_time_parseYear(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 2));
return n ? (date.y = d3_time_expandYear(+n[0]), i + n[0].length) : -1;
}
function d3_time_parseZone(date, string, i) {
return /^[+-]\d{4}$/.test(string = string.slice(i, i + 5)) ? (date.Z = -string, i + 5) : -1;
}
function d3_time_expandYear(d) {
return d + (d > 68 ? 1900 : 2000);
}
function d3_time_parseMonthNumber(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 2));
return n ? (date.m = n[0] - 1, i + n[0].length) : -1;
}
function d3_time_parseDay(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 2));
return n ? (date.d = +n[0], i + n[0].length) : -1;
}
function d3_time_parseDayOfYear(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 3));
return n ? (date.j = +n[0], i + n[0].length) : -1;
}
function d3_time_parseHour24(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 2));
return n ? (date.H = +n[0], i + n[0].length) : -1;
}
function d3_time_parseMinutes(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 2));
return n ? (date.M = +n[0], i + n[0].length) : -1;
}
function d3_time_parseSeconds(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 2));
return n ? (date.S = +n[0], i + n[0].length) : -1;
}
function d3_time_parseMilliseconds(date, string, i) {
d3_time_numberRe.lastIndex = 0;
var n = d3_time_numberRe.exec(string.slice(i, i + 3));
return n ? (date.L = +n[0], i + n[0].length) : -1;
}
function d3_time_zone(d) {
var z = d.getTimezoneOffset(), zs = z > 0 ? '-' : '+', zh = abs(z) / 60 | 0, zm = abs(z) % 60;
return zs + d3_time_formatPad(zh, '0', 2) + d3_time_formatPad(zm, '0', 2);
}
function d3_time_parseLiteralPercent(date, string, i) {
d3_time_percentRe.lastIndex = 0;
var n = d3_time_percentRe.exec(string.slice(i, i + 1));
return n ? i + n[0].length : -1;
}
function d3_time_formatMulti(formats) {
var n = formats.length, i = -1;
while (++i < n)
formats[i][0] = this(formats[i][0]);
return function (date) {
var i = 0, f = formats[i];
while (!f[1](date))
f = formats[++i];
return f[0](date);
};
}
d3.locale = function (locale) {
return {
numberFormat: d3_locale_numberFormat(locale),
timeFormat: d3_locale_timeFormat(locale)
};
};
var d3_locale_enUS = d3.locale({
decimal: '.',
thousands: ',',
grouping: [3],
currency: [
'$',
''
],
dateTime: '%a %b %e %X %Y',
date: '%m/%d/%Y',
time: '%H:%M:%S',
periods: [
'AM',
'PM'
],
days: [
'Sunday',
'Monday',
'Tuesday',
'Wednesday',
'Thursday',
'Friday',
'Saturday'
],
shortDays: [
'Sun',
'Mon',
'Tue',
'Wed',
'Thu',
'Fri',
'Sat'
],
months: [
'January',
'February',
'March',
'April',
'May',
'June',
'July',
'August',
'September',
'October',
'November',
'December'
],
shortMonths: [
'Jan',
'Feb',
'Mar',
'Apr',
'May',
'Jun',
'Jul',
'Aug',
'Sep',
'Oct',
'Nov',
'Dec'
]
});
d3.format = d3_locale_enUS.numberFormat;
d3.geo = {};
function d3_adder() {
}
d3_adder.prototype = {
s: 0,
t: 0,
add: function (y) {
d3_adderSum(y, this.t, d3_adderTemp);
d3_adderSum(d3_adderTemp.s, this.s, this);
if (this.s)
this.t += d3_adderTemp.t;
else
this.s = d3_adderTemp.t;
},
reset: function () {
this.s = this.t = 0;
},
valueOf: function () {
return this.s;
}
};
var d3_adderTemp = new d3_adder();
function d3_adderSum(a, b, o) {
var x = o.s = a + b, bv = x - a, av = x - bv;
o.t = a - av + (b - bv);
}
d3.geo.stream = function (object, listener) {
if (object && d3_geo_streamObjectType.hasOwnProperty(object.type)) {
d3_geo_streamObjectType[object.type](object, listener);
} else {
d3_geo_streamGeometry(object, listener);
}
};
function d3_geo_streamGeometry(geometry, listener) {
if (geometry && d3_geo_streamGeometryType.hasOwnProperty(geometry.type)) {
d3_geo_streamGeometryType[geometry.type](geometry, listener);
}
}
var d3_geo_streamObjectType = {
Feature: function (feature, listener) {
d3_geo_streamGeometry(feature.geometry, listener);
},
FeatureCollection: function (object, listener) {
var features = object.features, i = -1, n = features.length;
while (++i < n)
d3_geo_streamGeometry(features[i].geometry, listener);
}
};
var d3_geo_streamGeometryType = {
Sphere: function (object, listener) {
listener.sphere();
},
Point: function (object, listener) {
object = object.coordinates;
listener.point(object[0], object[1], object[2]);
},
MultiPoint: function (object, listener) {
var coordinates = object.coordinates, i = -1, n = coordinates.length;
while (++i < n)
object = coordinates[i], listener.point(object[0], object[1], object[2]);
},
LineString: function (object, listener) {
d3_geo_streamLine(object.coordinates, listener, 0);
},
MultiLineString: function (object, listener) {
var coordinates = object.coordinates, i = -1, n = coordinates.length;
while (++i < n)
d3_geo_streamLine(coordinates[i], listener, 0);
},
Polygon: function (object, listener) {
d3_geo_streamPolygon(object.coordinates, listener);
},
MultiPolygon: function (object, listener) {
var coordinates = object.coordinates, i = -1, n = coordinates.length;
while (++i < n)
d3_geo_streamPolygon(coordinates[i], listener);
},
GeometryCollection: function (object, listener) {
var geometries = object.geometries, i = -1, n = geometries.length;
while (++i < n)
d3_geo_streamGeometry(geometries[i], listener);
}
};
function d3_geo_streamLine(coordinates, listener, closed) {
var i = -1, n = coordinates.length - closed, coordinate;
listener.lineStart();
while (++i < n)
coordinate = coordinates[i], listener.point(coordinate[0], coordinate[1], coordinate[2]);
listener.lineEnd();
}
function d3_geo_streamPolygon(coordinates, listener) {
var i = -1, n = coordinates.length;
listener.polygonStart();
while (++i < n)
d3_geo_streamLine(coordinates[i], listener, 1);
listener.polygonEnd();
}
d3.geo.area = function (object) {
d3_geo_areaSum = 0;
d3.geo.stream(object, d3_geo_area);
return d3_geo_areaSum;
};
var d3_geo_areaSum, d3_geo_areaRingSum = new d3_adder();
var d3_geo_area = {
sphere: function () {
d3_geo_areaSum += 4 * π;
},
point: d3_noop,
lineStart: d3_noop,
lineEnd: d3_noop,
polygonStart: function () {
d3_geo_areaRingSum.reset();
d3_geo_area.lineStart = d3_geo_areaRingStart;
},
polygonEnd: function () {
var area = 2 * d3_geo_areaRingSum;
d3_geo_areaSum += area < 0 ? 4 * π + area : area;
d3_geo_area.lineStart = d3_geo_area.lineEnd = d3_geo_area.point = d3_noop;
}
};
function d3_geo_areaRingStart() {
var λ00, φ00, λ0, cosφ0, sinφ0;
d3_geo_area.point = function (λ, φ) {
d3_geo_area.point = nextPoint;
λ0 = (λ00 = λ) * d3_radians, cosφ0 = Math.cos(φ = (φ00 = φ) * d3_radians / 2 + π / 4), sinφ0 = Math.sin(φ);
};
function nextPoint(λ, φ) {
λ *= d3_radians;
φ = φ * d3_radians / 2 + π / 4;
var dλ = λ - λ0, sdλ = dλ >= 0 ? 1 : -1, adλ = sdλ * dλ, cosφ = Math.cos(φ), sinφ = Math.sin(φ), k = sinφ0 * sinφ, u = cosφ0 * cosφ + k * Math.cos(adλ), v = k * sdλ * Math.sin(adλ);
d3_geo_areaRingSum.add(Math.atan2(v, u));
λ0 = λ, cosφ0 = cosφ, sinφ0 = sinφ;
}
d3_geo_area.lineEnd = function () {
nextPoint(λ00, φ00);
};
}
function d3_geo_cartesian(spherical) {
var λ = spherical[0], φ = spherical[1], cosφ = Math.cos(φ);
return [
cosφ * Math.cos(λ),
cosφ * Math.sin(λ),
Math.sin(φ)
];
}
function d3_geo_cartesianDot(a, b) {
return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function d3_geo_cartesianCross(a, b) {
return [
a[1] * b[2] - a[2] * b[1],
a[2] * b[0] - a[0] * b[2],
a[0] * b[1] - a[1] * b[0]
];
}
function d3_geo_cartesianAdd(a, b) {
a[0] += b[0];
a[1] += b[1];
a[2] += b[2];
}
function d3_geo_cartesianScale(vector, k) {
return [
vector[0] * k,
vector[1] * k,
vector[2] * k
];
}
function d3_geo_cartesianNormalize(d) {
var l = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
d[0] /= l;
d[1] /= l;
d[2] /= l;
}
function d3_geo_spherical(cartesian) {
return [
Math.atan2(cartesian[1], cartesian[0]),
d3_asin(cartesian[2])
];
}
function d3_geo_sphericalEqual(a, b) {
return abs(a[0] - b[0]) < ε && abs(a[1] - b[1]) < ε;
}
d3.geo.bounds = function () {
var λ0, φ0, λ1, φ1, λ_, λ__, φ__, p0, dλSum, ranges, range;
var bound = {
point: point,
lineStart: lineStart,
lineEnd: lineEnd,
polygonStart: function () {
bound.point = ringPoint;
bound.lineStart = ringStart;
bound.lineEnd = ringEnd;
dλSum = 0;
d3_geo_area.polygonStart();
},
polygonEnd: function () {
d3_geo_area.polygonEnd();
bound.point = point;
bound.lineStart = lineStart;
bound.lineEnd = lineEnd;
if (d3_geo_areaRingSum < 0)
λ0 = -(λ1 = 180), φ0 = -(φ1 = 90);
else if (dλSum > ε)
φ1 = 90;
else if (dλSum < -ε)
φ0 = -90;
range[0] = λ0, range[1] = λ1;
}
};
function point(λ, φ) {
ranges.push(range = [
λ0 = λ,
λ1 = λ
]);
if (φ < φ0)
φ0 = φ;
if (φ > φ1)
φ1 = φ;
}
function linePoint(λ, φ) {
var p = d3_geo_cartesian([
λ * d3_radians,
φ * d3_radians
]);
if (p0) {
var normal = d3_geo_cartesianCross(p0, p), equatorial = [
normal[1],
-normal[0],
0
], inflection = d3_geo_cartesianCross(equatorial, normal);
d3_geo_cartesianNormalize(inflection);
inflection = d3_geo_spherical(inflection);
var dλ = λ - λ_, s = dλ > 0 ? 1 : -1, λi = inflection[0] * d3_degrees * s, antimeridian = abs(dλ) > 180;
if (antimeridian ^ (s * λ_ < λi && λi < s * λ)) {
var φi = inflection[1] * d3_degrees;
if (φi > φ1)
φ1 = φi;
} else if (λi = (λi + 360) % 360 - 180, antimeridian ^ (s * λ_ < λi && λi < s * λ)) {
var φi = -inflection[1] * d3_degrees;
if (φi < φ0)
φ0 = φi;
} else {
if (φ < φ0)
φ0 = φ;
if (φ > φ1)
φ1 = φ;
}
if (antimeridian) {
if (λ < λ_) {
if (angle(λ0, λ) > angle(λ0, λ1))
λ1 = λ;
} else {
if (angle(λ, λ1) > angle(λ0, λ1))
λ0 = λ;
}
} else {
if (λ1 >= λ0) {
if (λ < λ0)
λ0 = λ;
if (λ > λ1)
λ1 = λ;
} else {
if (λ > λ_) {
if (angle(λ0, λ) > angle(λ0, λ1))
λ1 = λ;
} else {
if (angle(λ, λ1) > angle(λ0, λ1))
λ0 = λ;
}
}
}
} else {
point(λ, φ);
}
p0 = p, λ_ = λ;
}
function lineStart() {
bound.point = linePoint;
}
function lineEnd() {
range[0] = λ0, range[1] = λ1;
bound.point = point;
p0 = null;
}
function ringPoint(λ, φ) {
if (p0) {
var dλ = λ - λ_;
dλSum += abs(dλ) > 180 ? dλ + (dλ > 0 ? 360 : -360) : dλ;
} else
λ__ = λ, φ__ = φ;
d3_geo_area.point(λ, φ);
linePoint(λ, φ);
}
function ringStart() {
d3_geo_area.lineStart();
}
function ringEnd() {
ringPoint(λ__, φ__);
d3_geo_area.lineEnd();
if (abs(dλSum) > ε)
λ0 = -(λ1 = 180);
range[0] = λ0, range[1] = λ1;
p0 = null;
}
function angle(λ0, λ1) {
return (λ1 -= λ0) < 0 ? λ1 + 360 : λ1;
}
function compareRanges(a, b) {
return a[0] - b[0];
}
function withinRange(x, range) {
return range[0] <= range[1] ? range[0] <= x && x <= range[1] : x < range[0] || range[1] < x;
}
return function (feature) {
φ1 = λ1 = -(λ0 = φ0 = Infinity);
ranges = [];
d3.geo.stream(feature, bound);
var n = ranges.length;
if (n) {
ranges.sort(compareRanges);
for (var i = 1, a = ranges[0], b, merged = [a]; i < n; ++i) {
b = ranges[i];
if (withinRange(b[0], a) || withinRange(b[1], a)) {
if (angle(a[0], b[1]) > angle(a[0], a[1]))
a[1] = b[1];
if (angle(b[0], a[1]) > angle(a[0], a[1]))
a[0] = b[0];
} else {
merged.push(a = b);
}
}
var best = -Infinity, dλ;
for (var n = merged.length - 1, i = 0, a = merged[n], b; i <= n; a = b, ++i) {
b = merged[i];
if ((dλ = angle(a[1], b[0])) > best)
best = dλ, λ0 = b[0], λ1 = a[1];
}
}
ranges = range = null;
return λ0 === Infinity || φ0 === Infinity ? [
[
NaN,
NaN
],
[
NaN,
NaN
]
] : [
[
λ0,
φ0
],
[
λ1,
φ1
]
];
};
}();
d3.geo.centroid = function (object) {
d3_geo_centroidW0 = d3_geo_centroidW1 = d3_geo_centroidX0 = d3_geo_centroidY0 = d3_geo_centroidZ0 = d3_geo_centroidX1 = d3_geo_centroidY1 = d3_geo_centroidZ1 = d3_geo_centroidX2 = d3_geo_centroidY2 = d3_geo_centroidZ2 = 0;
d3.geo.stream(object, d3_geo_centroid);
var x = d3_geo_centroidX2, y = d3_geo_centroidY2, z = d3_geo_centroidZ2, m = x * x + y * y + z * z;
if (m < ε2) {
x = d3_geo_centroidX1, y = d3_geo_centroidY1, z = d3_geo_centroidZ1;
if (d3_geo_centroidW1 < ε)
x = d3_geo_centroidX0, y = d3_geo_centroidY0, z = d3_geo_centroidZ0;
m = x * x + y * y + z * z;
if (m < ε2)
return [
NaN,
NaN
];
}
return [
Math.atan2(y, x) * d3_degrees,
d3_asin(z / Math.sqrt(m)) * d3_degrees
];
};
var d3_geo_centroidW0, d3_geo_centroidW1, d3_geo_centroidX0, d3_geo_centroidY0, d3_geo_centroidZ0, d3_geo_centroidX1, d3_geo_centroidY1, d3_geo_centroidZ1, d3_geo_centroidX2, d3_geo_centroidY2, d3_geo_centroidZ2;
var d3_geo_centroid = {
sphere: d3_noop,
point: d3_geo_centroidPoint,
lineStart: d3_geo_centroidLineStart,
lineEnd: d3_geo_centroidLineEnd,
polygonStart: function () {
d3_geo_centroid.lineStart = d3_geo_centroidRingStart;
},
polygonEnd: function () {
d3_geo_centroid.lineStart = d3_geo_centroidLineStart;
}
};
function d3_geo_centroidPoint(λ, φ) {
λ *= d3_radians;
var cosφ = Math.cos(φ *= d3_radians);
d3_geo_centroidPointXYZ(cosφ * Math.cos(λ), cosφ * Math.sin(λ), Math.sin(φ));
}
function d3_geo_centroidPointXYZ(x, y, z) {
++d3_geo_centroidW0;
d3_geo_centroidX0 += (x - d3_geo_centroidX0) / d3_geo_centroidW0;
d3_geo_centroidY0 += (y - d3_geo_centroidY0) / d3_geo_centroidW0;
d3_geo_centroidZ0 += (z - d3_geo_centroidZ0) / d3_geo_centroidW0;
}
function d3_geo_centroidLineStart() {
var x0, y0, z0;
d3_geo_centroid.point = function (λ, φ) {
λ *= d3_radians;
var cosφ = Math.cos(φ *= d3_radians);
x0 = cosφ * Math.cos(λ);
y0 = cosφ * Math.sin(λ);
z0 = Math.sin(φ);
d3_geo_centroid.point = nextPoint;
d3_geo_centroidPointXYZ(x0, y0, z0);
};
function nextPoint(λ, φ) {
λ *= d3_radians;
var cosφ = Math.cos(φ *= d3_radians), x = cosφ * Math.cos(λ), y = cosφ * Math.sin(λ), z = Math.sin(φ), w = Math.atan2(Math.sqrt((w = y0 * z - z0 * y) * w + (w = z0 * x - x0 * z) * w + (w = x0 * y - y0 * x) * w), x0 * x + y0 * y + z0 * z);
d3_geo_centroidW1 += w;
d3_geo_centroidX1 += w * (x0 + (x0 = x));
d3_geo_centroidY1 += w * (y0 + (y0 = y));
d3_geo_centroidZ1 += w * (z0 + (z0 = z));
d3_geo_centroidPointXYZ(x0, y0, z0);
}
}
function d3_geo_centroidLineEnd() {
d3_geo_centroid.point = d3_geo_centroidPoint;
}
function d3_geo_centroidRingStart() {
var λ00, φ00, x0, y0, z0;
d3_geo_centroid.point = function (λ, φ) {
λ00 = λ, φ00 = φ;
d3_geo_centroid.point = nextPoint;
λ *= d3_radians;
var cosφ = Math.cos(φ *= d3_radians);
x0 = cosφ * Math.cos(λ);
y0 = cosφ * Math.sin(λ);
z0 = Math.sin(φ);
d3_geo_centroidPointXYZ(x0, y0, z0);
};
d3_geo_centroid.lineEnd = function () {
nextPoint(λ00, φ00);
d3_geo_centroid.lineEnd = d3_geo_centroidLineEnd;
d3_geo_centroid.point = d3_geo_centroidPoint;
};
function nextPoint(λ, φ) {
λ *= d3_radians;
var cosφ = Math.cos(φ *= d3_radians), x = cosφ * Math.cos(λ), y = cosφ * Math.sin(λ), z = Math.sin(φ), cx = y0 * z - z0 * y, cy = z0 * x - x0 * z, cz = x0 * y - y0 * x, m = Math.sqrt(cx * cx + cy * cy + cz * cz), u = x0 * x + y0 * y + z0 * z, v = m && -d3_acos(u) / m, w = Math.atan2(m, u);
d3_geo_centroidX2 += v * cx;
d3_geo_centroidY2 += v * cy;
d3_geo_centroidZ2 += v * cz;
d3_geo_centroidW1 += w;
d3_geo_centroidX1 += w * (x0 + (x0 = x));
d3_geo_centroidY1 += w * (y0 + (y0 = y));
d3_geo_centroidZ1 += w * (z0 + (z0 = z));
d3_geo_centroidPointXYZ(x0, y0, z0);
}
}
function d3_geo_compose(a, b) {
function compose(x, y) {
return x = a(x, y), b(x[0], x[1]);
}
if (a.invert && b.invert)
compose.invert = function (x, y) {
return x = b.invert(x, y), x && a.invert(x[0], x[1]);
};
return compose;
}
function d3_true() {
return true;
}
function d3_geo_clipPolygon(segments, compare, clipStartInside, interpolate, listener) {
var subject = [], clip = [];
segments.forEach(function (segment) {
if ((n = segment.length - 1) <= 0)
return;
var n, p0 = segment[0], p1 = segment[n];
if (d3_geo_sphericalEqual(p0, p1)) {
listener.lineStart();
for (var i = 0; i < n; ++i)
listener.point((p0 = segment[i])[0], p0[1]);
listener.lineEnd();
return;
}
var a = new d3_geo_clipPolygonIntersection(p0, segment, null, true), b = new d3_geo_clipPolygonIntersection(p0, null, a, false);
a.o = b;
subject.push(a);
clip.push(b);
a = new d3_geo_clipPolygonIntersection(p1, segment, null, false);
b = new d3_geo_clipPolygonIntersection(p1, null, a, true);
a.o = b;
subject.push(a);
clip.push(b);
});
clip.sort(compare);
d3_geo_clipPolygonLinkCircular(subject);
d3_geo_clipPolygonLinkCircular(clip);
if (!subject.length)
return;
for (var i = 0, entry = clipStartInside, n = clip.length; i < n; ++i) {
clip[i].e = entry = !entry;
}
var start = subject[0], points, point;
while (1) {
var current = start, isSubject = true;
while (current.v)
if ((current = current.n) === start)
return;
points = current.z;
listener.lineStart();
do {
current.v = current.o.v = true;
if (current.e) {
if (isSubject) {
for (var i = 0, n = points.length; i < n; ++i)
listener.point((point = points[i])[0], point[1]);
} else {
interpolate(current.x, current.n.x, 1, listener);
}
current = current.n;
} else {
if (isSubject) {
points = current.p.z;
for (var i = points.length - 1; i >= 0; --i)
listener.point((point = points[i])[0], point[1]);
} else {
interpolate(current.x, current.p.x, -1, listener);
}
current = current.p;
}
current = current.o;
points = current.z;
isSubject = !isSubject;
} while (!current.v);
listener.lineEnd();
}
}
function d3_geo_clipPolygonLinkCircular(array) {
if (!(n = array.length))
return;
var n, i = 0, a = array[0], b;
while (++i < n) {
a.n = b = array[i];
b.p = a;
a = b;
}
a.n = b = array[0];
b.p = a;
}
function d3_geo_clipPolygonIntersection(point, points, other, entry) {
this.x = point;
this.z = points;
this.o = other;
this.e = entry;
this.v = false;
this.n = this.p = null;
}
function d3_geo_clip(pointVisible, clipLine, interpolate, clipStart) {
return function (rotate, listener) {
var line = clipLine(listener), rotatedClipStart = rotate.invert(clipStart[0], clipStart[1]);
var clip = {
point: point,
lineStart: lineStart,
lineEnd: lineEnd,
polygonStart: function () {
clip.point = pointRing;
clip.lineStart = ringStart;
clip.lineEnd = ringEnd;
segments = [];
polygon = [];
},
polygonEnd: function () {
clip.point = point;
clip.lineStart = lineStart;
clip.lineEnd = lineEnd;
segments = d3.merge(segments);
var clipStartInside = d3_geo_pointInPolygon(rotatedClipStart, polygon);
if (segments.length) {
if (!polygonStarted)
listener.polygonStart(), polygonStarted = true;
d3_geo_clipPolygon(segments, d3_geo_clipSort, clipStartInside, interpolate, listener);
} else if (clipStartInside) {
if (!polygonStarted)
listener.polygonStart(), polygonStarted = true;
listener.lineStart();
interpolate(null, null, 1, listener);
listener.lineEnd();
}
if (polygonStarted)
listener.polygonEnd(), polygonStarted = false;
segments = polygon = null;
},
sphere: function () {
listener.polygonStart();
listener.lineStart();
interpolate(null, null, 1, listener);
listener.lineEnd();
listener.polygonEnd();
}
};
function point(λ, φ) {
var point = rotate(λ, φ);
if (pointVisible(λ = point[0], φ = point[1]))
listener.point(λ, φ);
}
function pointLine(λ, φ) {
var point = rotate(λ, φ);
line.point(point[0], point[1]);
}
function lineStart() {
clip.point = pointLine;
line.lineStart();
}
function lineEnd() {
clip.point = point;
line.lineEnd();
}
var segments;
var buffer = d3_geo_clipBufferListener(), ringListener = clipLine(buffer), polygonStarted = false, polygon, ring;
function pointRing(λ, φ) {
ring.push([
λ,
φ
]);
var point = rotate(λ, φ);
ringListener.point(point[0], point[1]);
}
function ringStart() {
ringListener.lineStart();
ring = [];
}
function ringEnd() {
pointRing(ring[0][0], ring[0][1]);
ringListener.lineEnd();
var clean = ringListener.clean(), ringSegments = buffer.buffer(), segment, n = ringSegments.length;
ring.pop();
polygon.push(ring);
ring = null;
if (!n)
return;
if (clean & 1) {
segment = ringSegments[0];
var n = segment.length - 1, i = -1, point;
if (n > 0) {
if (!polygonStarted)
listener.polygonStart(), polygonStarted = true;
listener.lineStart();
while (++i < n)
listener.point((point = segment[i])[0], point[1]);
listener.lineEnd();
}
return;
}
if (n > 1 && clean & 2)
ringSegments.push(ringSegments.pop().concat(ringSegments.shift()));
segments.push(ringSegments.filter(d3_geo_clipSegmentLength1));
}
return clip;
};
}
function d3_geo_clipSegmentLength1(segment) {
return segment.length > 1;
}
function d3_geo_clipBufferListener() {
var lines = [], line;
return {
lineStart: function () {
lines.push(line = []);
},
point: function (λ, φ) {
line.push([
λ,
φ
]);
},
lineEnd: d3_noop,
buffer: function () {
var buffer = lines;
lines = [];
line = null;
return buffer;
},
rejoin: function () {
if (lines.length > 1)
lines.push(lines.pop().concat(lines.shift()));
}
};
}
function d3_geo_clipSort(a, b) {
return ((a = a.x)[0] < 0 ? a[1] - halfπ - ε : halfπ - a[1]) - ((b = b.x)[0] < 0 ? b[1] - halfπ - ε : halfπ - b[1]);
}
var d3_geo_clipAntimeridian = d3_geo_clip(d3_true, d3_geo_clipAntimeridianLine, d3_geo_clipAntimeridianInterpolate, [
-π,
-π / 2
]);
function d3_geo_clipAntimeridianLine(listener) {
var λ0 = NaN, φ0 = NaN, sλ0 = NaN, clean;
return {
lineStart: function () {
listener.lineStart();
clean = 1;
},
point: function (λ1, φ1) {
var sλ1 = λ1 > 0 ? π : -π, dλ = abs(λ1 - λ0);
if (abs(dλ - π) < ε) {
listener.point(λ0, φ0 = (φ0 + φ1) / 2 > 0 ? halfπ : -halfπ);
listener.point(sλ0, φ0);
listener.lineEnd();
listener.lineStart();
listener.point(sλ1, φ0);
listener.point(λ1, φ0);
clean = 0;
} else if (sλ0 !== sλ1 && dλ >= π) {
if (abs(λ0 - sλ0) < ε)
λ0 -= sλ0 * ε;
if (abs(λ1 - sλ1) < ε)
λ1 -= sλ1 * ε;
φ0 = d3_geo_clipAntimeridianIntersect(λ0, φ0, λ1, φ1);
listener.point(sλ0, φ0);
listener.lineEnd();
listener.lineStart();
listener.point(sλ1, φ0);
clean = 0;
}
listener.point(λ0 = λ1, φ0 = φ1);
sλ0 = sλ1;
},
lineEnd: function () {
listener.lineEnd();
λ0 = φ0 = NaN;
},
clean: function () {
return 2 - clean;
}
};
}
function d3_geo_clipAntimeridianIntersect(λ0, φ0, λ1, φ1) {
var cosφ0, cosφ1, sinλ0_λ1 = Math.sin(λ0 - λ1);
return abs(sinλ0_λ1) > ε ? Math.atan((Math.sin(φ0) * (cosφ1 = Math.cos(φ1)) * Math.sin(λ1) - Math.sin(φ1) * (cosφ0 = Math.cos(φ0)) * Math.sin(λ0)) / (cosφ0 * cosφ1 * sinλ0_λ1)) : (φ0 + φ1) / 2;
}
function d3_geo_clipAntimeridianInterpolate(from, to, direction, listener) {
var φ;
if (from == null) {
φ = direction * halfπ;
listener.point(-π, φ);
listener.point(0, φ);
listener.point(π, φ);
listener.point(π, 0);
listener.point(π, -φ);
listener.point(0, -φ);
listener.point(-π, -φ);
listener.point(-π, 0);
listener.point(-π, φ);
} else if (abs(from[0] - to[0]) > ε) {
var s = from[0] < to[0] ? π : -π;
φ = direction * s / 2;
listener.point(-s, φ);
listener.point(0, φ);
listener.point(s, φ);
} else {
listener.point(to[0], to[1]);
}
}
function d3_geo_pointInPolygon(point, polygon) {
var meridian = point[0], parallel = point[1], meridianNormal = [
Math.sin(meridian),
-Math.cos(meridian),
0
], polarAngle = 0, winding = 0;
d3_geo_areaRingSum.reset();
for (var i = 0, n = polygon.length; i < n; ++i) {
var ring = polygon[i], m = ring.length;
if (!m)
continue;
var point0 = ring[0], λ0 = point0[0], φ0 = point0[1] / 2 + π / 4, sinφ0 = Math.sin(φ0), cosφ0 = Math.cos(φ0), j = 1;
while (true) {
if (j === m)
j = 0;
point = ring[j];
var λ = point[0], φ = point[1] / 2 + π / 4, sinφ = Math.sin(φ), cosφ = Math.cos(φ), dλ = λ - λ0, sdλ = dλ >= 0 ? 1 : -1, adλ = sdλ * dλ, antimeridian = adλ > π, k = sinφ0 * sinφ;
d3_geo_areaRingSum.add(Math.atan2(k * sdλ * Math.sin(adλ), cosφ0 * cosφ + k * Math.cos(adλ)));
polarAngle += antimeridian ? dλ + sdλ * τ : dλ;
if (antimeridian ^ λ0 >= meridian ^ λ >= meridian) {
var arc = d3_geo_cartesianCross(d3_geo_cartesian(point0), d3_geo_cartesian(point));
d3_geo_cartesianNormalize(arc);
var intersection = d3_geo_cartesianCross(meridianNormal, arc);
d3_geo_cartesianNormalize(intersection);
var φarc = (antimeridian ^ dλ >= 0 ? -1 : 1) * d3_asin(intersection[2]);
if (parallel > φarc || parallel === φarc && (arc[0] || arc[1])) {
winding += antimeridian ^ dλ >= 0 ? 1 : -1;
}
}
if (!j++)
break;
λ0 = λ, sinφ0 = sinφ, cosφ0 = cosφ, point0 = point;
}
}
return (polarAngle < -ε || polarAngle < ε && d3_geo_areaRingSum < -ε) ^ winding & 1;
}
function d3_geo_clipCircle(radius) {
var cr = Math.cos(radius), smallRadius = cr > 0, notHemisphere = abs(cr) > ε, interpolate = d3_geo_circleInterpolate(radius, 6 * d3_radians);
return d3_geo_clip(visible, clipLine, interpolate, smallRadius ? [
0,
-radius
] : [
-π,
radius - π
]);
function visible(λ, φ) {
return Math.cos(λ) * Math.cos(φ) > cr;
}
function clipLine(listener) {
var point0, c0, v0, v00, clean;
return {
lineStart: function () {
v00 = v0 = false;
clean = 1;
},
point: function (λ, φ) {
var point1 = [
λ,
φ
], point2, v = visible(λ, φ), c = smallRadius ? v ? 0 : code(λ, φ) : v ? code(λ + (λ < 0 ? π : -π), φ) : 0;
if (!point0 && (v00 = v0 = v))
listener.lineStart();
if (v !== v0) {
point2 = intersect(point0, point1);
if (d3_geo_sphericalEqual(point0, point2) || d3_geo_sphericalEqual(point1, point2)) {
point1[0] += ε;
point1[1] += ε;
v = visible(point1[0], point1[1]);
}
}
if (v !== v0) {
clean = 0;
if (v) {
listener.lineStart();
point2 = intersect(point1, point0);
listener.point(point2[0], point2[1]);
} else {
point2 = intersect(point0, point1);
listener.point(point2[0], point2[1]);
listener.lineEnd();
}
point0 = point2;
} else if (notHemisphere && point0 && smallRadius ^ v) {
var t;
if (!(c & c0) && (t = intersect(point1, point0, true))) {
clean = 0;
if (smallRadius) {
listener.lineStart();
listener.point(t[0][0], t[0][1]);
listener.point(t[1][0], t[1][1]);
listener.lineEnd();
} else {
listener.point(t[1][0], t[1][1]);
listener.lineEnd();
listener.lineStart();
listener.point(t[0][0], t[0][1]);
}
}
}
if (v && (!point0 || !d3_geo_sphericalEqual(point0, point1))) {
listener.point(point1[0], point1[1]);
}
point0 = point1, v0 = v, c0 = c;
},
lineEnd: function () {
if (v0)
listener.lineEnd();
point0 = null;
},
clean: function () {
return clean | (v00 && v0) << 1;
}
};
}
function intersect(a, b, two) {
var pa = d3_geo_cartesian(a), pb = d3_geo_cartesian(b);
var n1 = [
1,
0,
0
], n2 = d3_geo_cartesianCross(pa, pb), n2n2 = d3_geo_cartesianDot(n2, n2), n1n2 = n2[0], determinant = n2n2 - n1n2 * n1n2;
if (!determinant)
return !two && a;
var c1 = cr * n2n2 / determinant, c2 = -cr * n1n2 / determinant, n1xn2 = d3_geo_cartesianCross(n1, n2), A = d3_geo_cartesianScale(n1, c1), B = d3_geo_cartesianScale(n2, c2);
d3_geo_cartesianAdd(A, B);
var u = n1xn2, w = d3_geo_cartesianDot(A, u), uu = d3_geo_cartesianDot(u, u), t2 = w * w - uu * (d3_geo_cartesianDot(A, A) - 1);
if (t2 < 0)
return;
var t = Math.sqrt(t2), q = d3_geo_cartesianScale(u, (-w - t) / uu);
d3_geo_cartesianAdd(q, A);
q = d3_geo_spherical(q);
if (!two)
return q;
var λ0 = a[0], λ1 = b[0], φ0 = a[1], φ1 = b[1], z;
if (λ1 < λ0)
z = λ0, λ0 = λ1, λ1 = z;
var δλ = λ1 - λ0, polar = abs(δλ - π) < ε, meridian = polar || δλ < ε;
if (!polar && φ1 < φ0)
z = φ0, φ0 = φ1, φ1 = z;
if (meridian ? polar ? φ0 + φ1 > 0 ^ q[1] < (abs(q[0] - λ0) < ε ? φ0 : φ1) : φ0 <= q[1] && q[1] <= φ1 : δλ > π ^ (λ0 <= q[0] && q[0] <= λ1)) {
var q1 = d3_geo_cartesianScale(u, (-w + t) / uu);
d3_geo_cartesianAdd(q1, A);
return [
q,
d3_geo_spherical(q1)
];
}
}
function code(λ, φ) {
var r = smallRadius ? radius : π - radius, code = 0;
if (λ < -r)
code |= 1;
else if (λ > r)
code |= 2;
if (φ < -r)
code |= 4;
else if (φ > r)
code |= 8;
return code;
}
}
function d3_geom_clipLine(x0, y0, x1, y1) {
return function (line) {
var a = line.a, b = line.b, ax = a.x, ay = a.y, bx = b.x, by = b.y, t0 = 0, t1 = 1, dx = bx - ax, dy = by - ay, r;
r = x0 - ax;
if (!dx && r > 0)
return;
r /= dx;
if (dx < 0) {
if (r < t0)
return;
if (r < t1)
t1 = r;
} else if (dx > 0) {
if (r > t1)
return;
if (r > t0)
t0 = r;
}
r = x1 - ax;
if (!dx && r < 0)
return;
r /= dx;
if (dx < 0) {
if (r > t1)
return;
if (r > t0)
t0 = r;
} else if (dx > 0) {
if (r < t0)
return;
if (r < t1)
t1 = r;
}
r = y0 - ay;
if (!dy && r > 0)
return;
r /= dy;
if (dy < 0) {
if (r < t0)
return;
if (r < t1)
t1 = r;
} else if (dy > 0) {
if (r > t1)
return;
if (r > t0)
t0 = r;
}
r = y1 - ay;
if (!dy && r < 0)
return;
r /= dy;
if (dy < 0) {
if (r > t1)
return;
if (r > t0)
t0 = r;
} else if (dy > 0) {
if (r < t0)
return;
if (r < t1)
t1 = r;
}
if (t0 > 0)
line.a = {
x: ax + t0 * dx,
y: ay + t0 * dy
};
if (t1 < 1)
line.b = {
x: ax + t1 * dx,
y: ay + t1 * dy
};
return line;
};
}
var d3_geo_clipExtentMAX = 1000000000;
d3.geo.clipExtent = function () {
var x0, y0, x1, y1, stream, clip, clipExtent = {
stream: function (output) {
if (stream)
stream.valid = false;
stream = clip(output);
stream.valid = true;
return stream;
},
extent: function (_) {
if (!arguments.length)
return [
[
x0,
y0
],
[
x1,
y1
]
];
clip = d3_geo_clipExtent(x0 = +_[0][0], y0 = +_[0][1], x1 = +_[1][0], y1 = +_[1][1]);
if (stream)
stream.valid = false, stream = null;
return clipExtent;
}
};
return clipExtent.extent([
[
0,
0
],
[
960,
500
]
]);
};
function d3_geo_clipExtent(x0, y0, x1, y1) {
return function (listener) {
var listener_ = listener, bufferListener = d3_geo_clipBufferListener(), clipLine = d3_geom_clipLine(x0, y0, x1, y1), segments, polygon, ring;
var clip = {
point: point,
lineStart: lineStart,
lineEnd: lineEnd,
polygonStart: function () {
listener = bufferListener;
segments = [];
polygon = [];
clean = true;
},
polygonEnd: function () {
listener = listener_;
segments = d3.merge(segments);
var clipStartInside = insidePolygon([
x0,
y1
]), inside = clean && clipStartInside, visible = segments.length;
if (inside || visible) {
listener.polygonStart();
if (inside) {
listener.lineStart();
interpolate(null, null, 1, listener);
listener.lineEnd();
}
if (visible) {
d3_geo_clipPolygon(segments, compare, clipStartInside, interpolate, listener);
}
listener.polygonEnd();
}
segments = polygon = ring = null;
}
};
function insidePolygon(p) {
var wn = 0, n = polygon.length, y = p[1];
for (var i = 0; i < n; ++i) {
for (var j = 1, v = polygon[i], m = v.length, a = v[0], b; j < m; ++j) {
b = v[j];
if (a[1] <= y) {
if (b[1] > y && d3_cross2d(a, b, p) > 0)
++wn;
} else {
if (b[1] <= y && d3_cross2d(a, b, p) < 0)
--wn;
}
a = b;
}
}
return wn !== 0;
}
function interpolate(from, to, direction, listener) {
var a = 0, a1 = 0;
if (from == null || (a = corner(from, direction)) !== (a1 = corner(to, direction)) || comparePoints(from, to) < 0 ^ direction > 0) {
do {
listener.point(a === 0 || a === 3 ? x0 : x1, a > 1 ? y1 : y0);
} while ((a = (a + direction + 4) % 4) !== a1);
} else {
listener.point(to[0], to[1]);
}
}
function pointVisible(x, y) {
return x0 <= x && x <= x1 && y0 <= y && y <= y1;
}
function point(x, y) {
if (pointVisible(x, y))
listener.point(x, y);
}
var x__, y__, v__, x_, y_, v_, first, clean;
function lineStart() {
clip.point = linePoint;
if (polygon)
polygon.push(ring = []);
first = true;
v_ = false;
x_ = y_ = NaN;
}
function lineEnd() {
if (segments) {
linePoint(x__, y__);
if (v__ && v_)
bufferListener.rejoin();
segments.push(bufferListener.buffer());
}
clip.point = point;
if (v_)
listener.lineEnd();
}
function linePoint(x, y) {
x = Math.max(-d3_geo_clipExtentMAX, Math.min(d3_geo_clipExtentMAX, x));
y = Math.max(-d3_geo_clipExtentMAX, Math.min(d3_geo_clipExtentMAX, y));
var v = pointVisible(x, y);
if (polygon)
ring.push([
x,
y
]);
if (first) {
x__ = x, y__ = y, v__ = v;
first = false;
if (v) {
listener.lineStart();
listener.point(x, y);
}
} else {
if (v && v_)
listener.point(x, y);
else {
var l = {
a: {
x: x_,
y: y_
},
b: {
x: x,
y: y
}
};
if (clipLine(l)) {
if (!v_) {
listener.lineStart();
listener.point(l.a.x, l.a.y);
}
listener.point(l.b.x, l.b.y);
if (!v)
listener.lineEnd();
clean = false;
} else if (v) {
listener.lineStart();
listener.point(x, y);
clean = false;
}
}
}
x_ = x, y_ = y, v_ = v;
}
return clip;
};
function corner(p, direction) {
return abs(p[0] - x0) < ε ? direction > 0 ? 0 : 3 : abs(p[0] - x1) < ε ? direction > 0 ? 2 : 1 : abs(p[1] - y0) < ε ? direction > 0 ? 1 : 0 : direction > 0 ? 3 : 2;
}
function compare(a, b) {
return comparePoints(a.x, b.x);
}
function comparePoints(a, b) {
var ca = corner(a, 1), cb = corner(b, 1);
return ca !== cb ? ca - cb : ca === 0 ? b[1] - a[1] : ca === 1 ? a[0] - b[0] : ca === 2 ? a[1] - b[1] : b[0] - a[0];
}
}
function d3_geo_conic(projectAt) {
var φ0 = 0, φ1 = π / 3, m = d3_geo_projectionMutator(projectAt), p = m(φ0, φ1);
p.parallels = function (_) {
if (!arguments.length)
return [
φ0 / π * 180,
φ1 / π * 180
];
return m(φ0 = _[0] * π / 180, φ1 = _[1] * π / 180);
};
return p;
}
function d3_geo_conicEqualArea(φ0, φ1) {
var sinφ0 = Math.sin(φ0), n = (sinφ0 + Math.sin(φ1)) / 2, C = 1 + sinφ0 * (2 * n - sinφ0), ρ0 = Math.sqrt(C) / n;
function forward(λ, φ) {
var ρ = Math.sqrt(C - 2 * n * Math.sin(φ)) / n;
return [
ρ * Math.sin(λ *= n),
ρ0 - ρ * Math.cos(λ)
];
}
forward.invert = function (x, y) {
var ρ0_y = ρ0 - y;
return [
Math.atan2(x, ρ0_y) / n,
d3_asin((C - (x * x + ρ0_y * ρ0_y) * n * n) / (2 * n))
];
};
return forward;
}
(d3.geo.conicEqualArea = function () {
return d3_geo_conic(d3_geo_conicEqualArea);
}).raw = d3_geo_conicEqualArea;
d3.geo.albers = function () {
return d3.geo.conicEqualArea().rotate([
96,
0
]).center([
-0.6,
38.7
]).parallels([
29.5,
45.5
]).scale(1070);
};
d3.geo.albersUsa = function () {
var lower48 = d3.geo.albers();
var alaska = d3.geo.conicEqualArea().rotate([
154,
0
]).center([
-2,
58.5
]).parallels([
55,
65
]);
var hawaii = d3.geo.conicEqualArea().rotate([
157,
0
]).center([
-3,
19.9
]).parallels([
8,
18
]);
var point, pointStream = {
point: function (x, y) {
point = [
x,
y
];
}
}, lower48Point, alaskaPoint, hawaiiPoint;
function albersUsa(coordinates) {
var x = coordinates[0], y = coordinates[1];
point = null;
(lower48Point(x, y), point) || (alaskaPoint(x, y), point) || hawaiiPoint(x, y);
return point;
}
albersUsa.invert = function (coordinates) {
var k = lower48.scale(), t = lower48.translate(), x = (coordinates[0] - t[0]) / k, y = (coordinates[1] - t[1]) / k;
return (y >= 0.12 && y < 0.234 && x >= -0.425 && x < -0.214 ? alaska : y >= 0.166 && y < 0.234 && x >= -0.214 && x < -0.115 ? hawaii : lower48).invert(coordinates);
};
albersUsa.stream = function (stream) {
var lower48Stream = lower48.stream(stream), alaskaStream = alaska.stream(stream), hawaiiStream = hawaii.stream(stream);
return {
point: function (x, y) {
lower48Stream.point(x, y);
alaskaStream.point(x, y);
hawaiiStream.point(x, y);
},
sphere: function () {
lower48Stream.sphere();
alaskaStream.sphere();
hawaiiStream.sphere();
},
lineStart: function () {
lower48Stream.lineStart();
alaskaStream.lineStart();
hawaiiStream.lineStart();
},
lineEnd: function () {
lower48Stream.lineEnd();
alaskaStream.lineEnd();
hawaiiStream.lineEnd();
},
polygonStart: function () {
lower48Stream.polygonStart();
alaskaStream.polygonStart();
hawaiiStream.polygonStart();
},
polygonEnd: function () {
lower48Stream.polygonEnd();
alaskaStream.polygonEnd();
hawaiiStream.polygonEnd();
}
};
};
albersUsa.precision = function (_) {
if (!arguments.length)
return lower48.precision();
lower48.precision(_);
alaska.precision(_);
hawaii.precision(_);
return albersUsa;
};
albersUsa.scale = function (_) {
if (!arguments.length)
return lower48.scale();
lower48.scale(_);
alaska.scale(_ * 0.35);
hawaii.scale(_);
return albersUsa.translate(lower48.translate());
};
albersUsa.translate = function (_) {
if (!arguments.length)
return lower48.translate();
var k = lower48.scale(), x = +_[0], y = +_[1];
lower48Point = lower48.translate(_).clipExtent([
[
x - 0.455 * k,
y - 0.238 * k
],
[
x + 0.455 * k,
y + 0.238 * k
]
]).stream(pointStream).point;
alaskaPoint = alaska.translate([
x - 0.307 * k,
y + 0.201 * k
]).clipExtent([
[
x - 0.425 * k + ε,
y + 0.12 * k + ε
],
[
x - 0.214 * k - ε,
y + 0.234 * k - ε
]
]).stream(pointStream).point;
hawaiiPoint = hawaii.translate([
x - 0.205 * k,
y + 0.212 * k
]).clipExtent([
[
x - 0.214 * k + ε,
y + 0.166 * k + ε
],
[
x - 0.115 * k - ε,
y + 0.234 * k - ε
]
]).stream(pointStream).point;
return albersUsa;
};
return albersUsa.scale(1070);
};
var d3_geo_pathAreaSum, d3_geo_pathAreaPolygon, d3_geo_pathArea = {
point: d3_noop,
lineStart: d3_noop,
lineEnd: d3_noop,
polygonStart: function () {
d3_geo_pathAreaPolygon = 0;
d3_geo_pathArea.lineStart = d3_geo_pathAreaRingStart;
},
polygonEnd: function () {
d3_geo_pathArea.lineStart = d3_geo_pathArea.lineEnd = d3_geo_pathArea.point = d3_noop;
d3_geo_pathAreaSum += abs(d3_geo_pathAreaPolygon / 2);
}
};
function d3_geo_pathAreaRingStart() {
var x00, y00, x0, y0;
d3_geo_pathArea.point = function (x, y) {
d3_geo_pathArea.point = nextPoint;
x00 = x0 = x, y00 = y0 = y;
};
function nextPoint(x, y) {
d3_geo_pathAreaPolygon += y0 * x - x0 * y;
x0 = x, y0 = y;
}
d3_geo_pathArea.lineEnd = function () {
nextPoint(x00, y00);
};
}
var d3_geo_pathBoundsX0, d3_geo_pathBoundsY0, d3_geo_pathBoundsX1, d3_geo_pathBoundsY1;
var d3_geo_pathBounds = {
point: d3_geo_pathBoundsPoint,
lineStart: d3_noop,
lineEnd: d3_noop,
polygonStart: d3_noop,
polygonEnd: d3_noop
};
function d3_geo_pathBoundsPoint(x, y) {
if (x < d3_geo_pathBoundsX0)
d3_geo_pathBoundsX0 = x;
if (x > d3_geo_pathBoundsX1)
d3_geo_pathBoundsX1 = x;
if (y < d3_geo_pathBoundsY0)
d3_geo_pathBoundsY0 = y;
if (y > d3_geo_pathBoundsY1)
d3_geo_pathBoundsY1 = y;
}
function d3_geo_pathBuffer() {
var pointCircle = d3_geo_pathBufferCircle(4.5), buffer = [];
var stream = {
point: point,
lineStart: function () {
stream.point = pointLineStart;
},
lineEnd: lineEnd,
polygonStart: function () {
stream.lineEnd = lineEndPolygon;
},
polygonEnd: function () {
stream.lineEnd = lineEnd;
stream.point = point;
},
pointRadius: function (_) {
pointCircle = d3_geo_pathBufferCircle(_);
return stream;
},
result: function () {
if (buffer.length) {
var result = buffer.join('');
buffer = [];
return result;
}
}
};
function point(x, y) {
buffer.push('M', x, ',', y, pointCircle);
}
function pointLineStart(x, y) {
buffer.push('M', x, ',', y);
stream.point = pointLine;
}
function pointLine(x, y) {
buffer.push('L', x, ',', y);
}
function lineEnd() {
stream.point = point;
}
function lineEndPolygon() {
buffer.push('Z');
}
return stream;
}
function d3_geo_pathBufferCircle(radius) {
return 'm0,' + radius + 'a' + radius + ',' + radius + ' 0 1,1 0,' + -2 * radius + 'a' + radius + ',' + radius + ' 0 1,1 0,' + 2 * radius + 'z';
}
var d3_geo_pathCentroid = {
point: d3_geo_pathCentroidPoint,
lineStart: d3_geo_pathCentroidLineStart,
lineEnd: d3_geo_pathCentroidLineEnd,
polygonStart: function () {
d3_geo_pathCentroid.lineStart = d3_geo_pathCentroidRingStart;
},
polygonEnd: function () {
d3_geo_pathCentroid.point = d3_geo_pathCentroidPoint;
d3_geo_pathCentroid.lineStart = d3_geo_pathCentroidLineStart;
d3_geo_pathCentroid.lineEnd = d3_geo_pathCentroidLineEnd;
}
};
function d3_geo_pathCentroidPoint(x, y) {
d3_geo_centroidX0 += x;
d3_geo_centroidY0 += y;
++d3_geo_centroidZ0;
}
function d3_geo_pathCentroidLineStart() {
var x0, y0;
d3_geo_pathCentroid.point = function (x, y) {
d3_geo_pathCentroid.point = nextPoint;
d3_geo_pathCentroidPoint(x0 = x, y0 = y);
};
function nextPoint(x, y) {
var dx = x - x0, dy = y - y0, z = Math.sqrt(dx * dx + dy * dy);
d3_geo_centroidX1 += z * (x0 + x) / 2;
d3_geo_centroidY1 += z * (y0 + y) / 2;
d3_geo_centroidZ1 += z;
d3_geo_pathCentroidPoint(x0 = x, y0 = y);
}
}
function d3_geo_pathCentroidLineEnd() {
d3_geo_pathCentroid.point = d3_geo_pathCentroidPoint;
}
function d3_geo_pathCentroidRingStart() {
var x00, y00, x0, y0;
d3_geo_pathCentroid.point = function (x, y) {
d3_geo_pathCentroid.point = nextPoint;
d3_geo_pathCentroidPoint(x00 = x0 = x, y00 = y0 = y);
};
function nextPoint(x, y) {
var dx = x - x0, dy = y - y0, z = Math.sqrt(dx * dx + dy * dy);
d3_geo_centroidX1 += z * (x0 + x) / 2;
d3_geo_centroidY1 += z * (y0 + y) / 2;
d3_geo_centroidZ1 += z;
z = y0 * x - x0 * y;
d3_geo_centroidX2 += z * (x0 + x);
d3_geo_centroidY2 += z * (y0 + y);
d3_geo_centroidZ2 += z * 3;
d3_geo_pathCentroidPoint(x0 = x, y0 = y);
}
d3_geo_pathCentroid.lineEnd = function () {
nextPoint(x00, y00);
};
}
function d3_geo_pathContext(context) {
var pointRadius = 4.5;
var stream = {
point: point,
lineStart: function () {
stream.point = pointLineStart;
},
lineEnd: lineEnd,
polygonStart: function () {
stream.lineEnd = lineEndPolygon;
},
polygonEnd: function () {
stream.lineEnd = lineEnd;
stream.point = point;
},
pointRadius: function (_) {
pointRadius = _;
return stream;
},
result: d3_noop
};
function point(x, y) {
context.moveTo(x + pointRadius, y);
context.arc(x, y, pointRadius, 0, τ);
}
function pointLineStart(x, y) {
context.moveTo(x, y);
stream.point = pointLine;
}
function pointLine(x, y) {
context.lineTo(x, y);
}
function lineEnd() {
stream.point = point;
}
function lineEndPolygon() {
context.closePath();
}
return stream;
}
function d3_geo_resample(project) {
var δ2 = 0.5, cosMinDistance = Math.cos(30 * d3_radians), maxDepth = 16;
function resample(stream) {
return (maxDepth ? resampleRecursive : resampleNone)(stream);
}
function resampleNone(stream) {
return d3_geo_transformPoint(stream, function (x, y) {
x = project(x, y);
stream.point(x[0], x[1]);
});
}
function resampleRecursive(stream) {
var λ00, φ00, x00, y00, a00, b00, c00, λ0, x0, y0, a0, b0, c0;
var resample = {
point: point,
lineStart: lineStart,
lineEnd: lineEnd,
polygonStart: function () {
stream.polygonStart();
resample.lineStart = ringStart;
},
polygonEnd: function () {
stream.polygonEnd();
resample.lineStart = lineStart;
}
};
function point(x, y) {
x = project(x, y);
stream.point(x[0], x[1]);
}
function lineStart() {
x0 = NaN;
resample.point = linePoint;
stream.lineStart();
}
function linePoint(λ, φ) {
var c = d3_geo_cartesian([
λ,
φ
]), p = project(λ, φ);
resampleLineTo(x0, y0, λ0, a0, b0, c0, x0 = p[0], y0 = p[1], λ0 = λ, a0 = c[0], b0 = c[1], c0 = c[2], maxDepth, stream);
stream.point(x0, y0);
}
function lineEnd() {
resample.point = point;
stream.lineEnd();
}
function ringStart() {
lineStart();
resample.point = ringPoint;
resample.lineEnd = ringEnd;
}
function ringPoint(λ, φ) {
linePoint(λ00 = λ, φ00 = φ), x00 = x0, y00 = y0, a00 = a0, b00 = b0, c00 = c0;
resample.point = linePoint;
}
function ringEnd() {
resampleLineTo(x0, y0, λ0, a0, b0, c0, x00, y00, λ00, a00, b00, c00, maxDepth, stream);
resample.lineEnd = lineEnd;
lineEnd();
}
return resample;
}
function resampleLineTo(x0, y0, λ0, a0, b0, c0, x1, y1, λ1, a1, b1, c1, depth, stream) {
var dx = x1 - x0, dy = y1 - y0, d2 = dx * dx + dy * dy;
if (d2 > 4 * δ2 && depth--) {
var a = a0 + a1, b = b0 + b1, c = c0 + c1, m = Math.sqrt(a * a + b * b + c * c), φ2 = Math.asin(c /= m), λ2 = abs(abs(c) - 1) < ε || abs(λ0 - λ1) < ε ? (λ0 + λ1) / 2 : Math.atan2(b, a), p = project(λ2, φ2), x2 = p[0], y2 = p[1], dx2 = x2 - x0, dy2 = y2 - y0, dz = dy * dx2 - dx * dy2;
if (dz * dz / d2 > δ2 || abs((dx * dx2 + dy * dy2) / d2 - 0.5) > 0.3 || a0 * a1 + b0 * b1 + c0 * c1 < cosMinDistance) {
resampleLineTo(x0, y0, λ0, a0, b0, c0, x2, y2, λ2, a /= m, b /= m, c, depth, stream);
stream.point(x2, y2);
resampleLineTo(x2, y2, λ2, a, b, c, x1, y1, λ1, a1, b1, c1, depth, stream);
}
}
}
resample.precision = function (_) {
if (!arguments.length)
return Math.sqrt(δ2);
maxDepth = (δ2 = _ * _) > 0 && 16;
return resample;
};
return resample;
}
d3.geo.path = function () {
var pointRadius = 4.5, projection, context, projectStream, contextStream, cacheStream;
function path(object) {
if (object) {
if (typeof pointRadius === 'function')
contextStream.pointRadius(+pointRadius.apply(this, arguments));
if (!cacheStream || !cacheStream.valid)
cacheStream = projectStream(contextStream);
d3.geo.stream(object, cacheStream);
}
return contextStream.result();
}
path.area = function (object) {
d3_geo_pathAreaSum = 0;
d3.geo.stream(object, projectStream(d3_geo_pathArea));
return d3_geo_pathAreaSum;
};
path.centroid = function (object) {
d3_geo_centroidX0 = d3_geo_centroidY0 = d3_geo_centroidZ0 = d3_geo_centroidX1 = d3_geo_centroidY1 = d3_geo_centroidZ1 = d3_geo_centroidX2 = d3_geo_centroidY2 = d3_geo_centroidZ2 = 0;
d3.geo.stream(object, projectStream(d3_geo_pathCentroid));
return d3_geo_centroidZ2 ? [
d3_geo_centroidX2 / d3_geo_centroidZ2,
d3_geo_centroidY2 / d3_geo_centroidZ2
] : d3_geo_centroidZ1 ? [
d3_geo_centroidX1 / d3_geo_centroidZ1,
d3_geo_centroidY1 / d3_geo_centroidZ1
] : d3_geo_centroidZ0 ? [
d3_geo_centroidX0 / d3_geo_centroidZ0,
d3_geo_centroidY0 / d3_geo_centroidZ0
] : [
NaN,
NaN
];
};
path.bounds = function (object) {
d3_geo_pathBoundsX1 = d3_geo_pathBoundsY1 = -(d3_geo_pathBoundsX0 = d3_geo_pathBoundsY0 = Infinity);
d3.geo.stream(object, projectStream(d3_geo_pathBounds));
return [
[
d3_geo_pathBoundsX0,
d3_geo_pathBoundsY0
],
[
d3_geo_pathBoundsX1,
d3_geo_pathBoundsY1
]
];
};
path.projection = function (_) {
if (!arguments.length)
return projection;
projectStream = (projection = _) ? _.stream || d3_geo_pathProjectStream(_) : d3_identity;
return reset();
};
path.context = function (_) {
if (!arguments.length)
return context;
contextStream = (context = _) == null ? new d3_geo_pathBuffer() : new d3_geo_pathContext(_);
if (typeof pointRadius !== 'function')
contextStream.pointRadius(pointRadius);
return reset();
};
path.pointRadius = function (_) {
if (!arguments.length)
return pointRadius;
pointRadius = typeof _ === 'function' ? _ : (contextStream.pointRadius(+_), +_);
return path;
};
function reset() {
cacheStream = null;
return path;
}
return path.projection(d3.geo.albersUsa()).context(null);
};
function d3_geo_pathProjectStream(project) {
var resample = d3_geo_resample(function (x, y) {
return project([
x * d3_degrees,
y * d3_degrees
]);
});
return function (stream) {
return d3_geo_projectionRadians(resample(stream));
};
}
d3.geo.transform = function (methods) {
return {
stream: function (stream) {
var transform = new d3_geo_transform(stream);
for (var k in methods)
transform[k] = methods[k];
return transform;
}
};
};
function d3_geo_transform(stream) {
this.stream = stream;
}
d3_geo_transform.prototype = {
point: function (x, y) {
this.stream.point(x, y);
},
sphere: function () {
this.stream.sphere();
},
lineStart: function () {
this.stream.lineStart();
},
lineEnd: function () {
this.stream.lineEnd();
},
polygonStart: function () {
this.stream.polygonStart();
},
polygonEnd: function () {
this.stream.polygonEnd();
}
};
function d3_geo_transformPoint(stream, point) {
return {
point: point,
sphere: function () {
stream.sphere();
},
lineStart: function () {
stream.lineStart();
},
lineEnd: function () {
stream.lineEnd();
},
polygonStart: function () {
stream.polygonStart();
},
polygonEnd: function () {
stream.polygonEnd();
}
};
}
d3.geo.projection = d3_geo_projection;
d3.geo.projectionMutator = d3_geo_projectionMutator;
function d3_geo_projection(project) {
return d3_geo_projectionMutator(function () {
return project;
})();
}
function d3_geo_projectionMutator(projectAt) {
var project, rotate, projectRotate, projectResample = d3_geo_resample(function (x, y) {
x = project(x, y);
return [
x[0] * k + δx,
δy - x[1] * k
];
}), k = 150, x = 480, y = 250, λ = 0, φ = 0, δλ = 0, δφ = 0, δγ = 0, δx, δy, preclip = d3_geo_clipAntimeridian, postclip = d3_identity, clipAngle = null, clipExtent = null, stream;
function projection(point) {
point = projectRotate(point[0] * d3_radians, point[1] * d3_radians);
return [
point[0] * k + δx,
δy - point[1] * k
];
}
function invert(point) {
point = projectRotate.invert((point[0] - δx) / k, (δy - point[1]) / k);
return point && [
point[0] * d3_degrees,
point[1] * d3_degrees
];
}
projection.stream = function (output) {
if (stream)
stream.valid = false;
stream = d3_geo_projectionRadians(preclip(rotate, projectResample(postclip(output))));
stream.valid = true;
return stream;
};
projection.clipAngle = function (_) {
if (!arguments.length)
return clipAngle;
preclip = _ == null ? (clipAngle = _, d3_geo_clipAntimeridian) : d3_geo_clipCircle((clipAngle = +_) * d3_radians);
return invalidate();
};
projection.clipExtent = function (_) {
if (!arguments.length)
return clipExtent;
clipExtent = _;
postclip = _ ? d3_geo_clipExtent(_[0][0], _[0][1], _[1][0], _[1][1]) : d3_identity;
return invalidate();
};
projection.scale = function (_) {
if (!arguments.length)
return k;
k = +_;
return reset();
};
projection.translate = function (_) {
if (!arguments.length)
return [
x,
y
];
x = +_[0];
y = +_[1];
return reset();
};
projection.center = function (_) {
if (!arguments.length)
return [
λ * d3_degrees,
φ * d3_degrees
];
λ = _[0] % 360 * d3_radians;
φ = _[1] % 360 * d3_radians;
return reset();
};
projection.rotate = function (_) {
if (!arguments.length)
return [
δλ * d3_degrees,
δφ * d3_degrees,
δγ * d3_degrees
];
δλ = _[0] % 360 * d3_radians;
δφ = _[1] % 360 * d3_radians;
δγ = _.length > 2 ? _[2] % 360 * d3_radians : 0;
return reset();
};
d3.rebind(projection, projectResample, 'precision');
function reset() {
projectRotate = d3_geo_compose(rotate = d3_geo_rotation(δλ, δφ, δγ), project);
var center = project(λ, φ);
δx = x - center[0] * k;
δy = y + center[1] * k;
return invalidate();
}
function invalidate() {
if (stream)
stream.valid = false, stream = null;
return projection;
}
return function () {
project = projectAt.apply(this, arguments);
projection.invert = project.invert && invert;
return reset();
};
}
function d3_geo_projectionRadians(stream) {
return d3_geo_transformPoint(stream, function (x, y) {
stream.point(x * d3_radians, y * d3_radians);
});
}
function d3_geo_equirectangular(λ, φ) {
return [
λ,
φ
];
}
(d3.geo.equirectangular = function () {
return d3_geo_projection(d3_geo_equirectangular);
}).raw = d3_geo_equirectangular.invert = d3_geo_equirectangular;
d3.geo.rotation = function (rotate) {
rotate = d3_geo_rotation(rotate[0] % 360 * d3_radians, rotate[1] * d3_radians, rotate.length > 2 ? rotate[2] * d3_radians : 0);
function forward(coordinates) {
coordinates = rotate(coordinates[0] * d3_radians, coordinates[1] * d3_radians);
return coordinates[0] *= d3_degrees, coordinates[1] *= d3_degrees, coordinates;
}
forward.invert = function (coordinates) {
coordinates = rotate.invert(coordinates[0] * d3_radians, coordinates[1] * d3_radians);
return coordinates[0] *= d3_degrees, coordinates[1] *= d3_degrees, coordinates;
};
return forward;
};
function d3_geo_identityRotation(λ, φ) {
return [
λ > π ? λ - τ : λ < -π ? λ + τ : λ,
φ
];
}
d3_geo_identityRotation.invert = d3_geo_equirectangular;
function d3_geo_rotation(δλ, δφ, δγ) {
return δλ ? δφ || δγ ? d3_geo_compose(d3_geo_rotationλ(δλ), d3_geo_rotationφγ(δφ, δγ)) : d3_geo_rotationλ(δλ) : δφ || δγ ? d3_geo_rotationφγ(δφ, δγ) : d3_geo_identityRotation;
}
function d3_geo_forwardRotationλ(δλ) {
return function (λ, φ) {
return λ += δλ, [
λ > π ? λ - τ : λ < -π ? λ + τ : λ,
φ
];
};
}
function d3_geo_rotationλ(δλ) {
var rotation = d3_geo_forwardRotationλ(δλ);
rotation.invert = d3_geo_forwardRotationλ(-δλ);
return rotation;
}
function d3_geo_rotationφγ(δφ, δγ) {
var cosδφ = Math.cos(δφ), sinδφ = Math.sin(δφ), cosδγ = Math.cos(δγ), sinδγ = Math.sin(δγ);
function rotation(λ, φ) {
var cosφ = Math.cos(φ), x = Math.cos(λ) * cosφ, y = Math.sin(λ) * cosφ, z = Math.sin(φ), k = z * cosδφ + x * sinδφ;
return [
Math.atan2(y * cosδγ - k * sinδγ, x * cosδφ - z * sinδφ),
d3_asin(k * cosδγ + y * sinδγ)
];
}
rotation.invert = function (λ, φ) {
var cosφ = Math.cos(φ), x = Math.cos(λ) * cosφ, y = Math.sin(λ) * cosφ, z = Math.sin(φ), k = z * cosδγ - y * sinδγ;
return [
Math.atan2(y * cosδγ + z * sinδγ, x * cosδφ + k * sinδφ),
d3_asin(k * cosδφ - x * sinδφ)
];
};
return rotation;
}
d3.geo.circle = function () {
var origin = [
0,
0
], angle, precision = 6, interpolate;
function circle() {
var center = typeof origin === 'function' ? origin.apply(this, arguments) : origin, rotate = d3_geo_rotation(-center[0] * d3_radians, -center[1] * d3_radians, 0).invert, ring = [];
interpolate(null, null, 1, {
point: function (x, y) {
ring.push(x = rotate(x, y));
x[0] *= d3_degrees, x[1] *= d3_degrees;
}
});
return {
type: 'Polygon',
coordinates: [ring]
};
}
circle.origin = function (x) {
if (!arguments.length)
return origin;
origin = x;
return circle;
};
circle.angle = function (x) {
if (!arguments.length)
return angle;
interpolate = d3_geo_circleInterpolate((angle = +x) * d3_radians, precision * d3_radians);
return circle;
};
circle.precision = function (_) {
if (!arguments.length)
return precision;
interpolate = d3_geo_circleInterpolate(angle * d3_radians, (precision = +_) * d3_radians);
return circle;
};
return circle.angle(90);
};
function d3_geo_circleInterpolate(radius, precision) {
var cr = Math.cos(radius), sr = Math.sin(radius);
return function (from, to, direction, listener) {
var step = direction * precision;
if (from != null) {
from = d3_geo_circleAngle(cr, from);
to = d3_geo_circleAngle(cr, to);
if (direction > 0 ? from < to : from > to)
from += direction * τ;
} else {
from = radius + direction * τ;
to = radius - 0.5 * step;
}
for (var point, t = from; direction > 0 ? t > to : t < to; t -= step) {
listener.point((point = d3_geo_spherical([
cr,
-sr * Math.cos(t),
-sr * Math.sin(t)
]))[0], point[1]);
}
};
}
function d3_geo_circleAngle(cr, point) {
var a = d3_geo_cartesian(point);
a[0] -= cr;
d3_geo_cartesianNormalize(a);
var angle = d3_acos(-a[1]);
return ((-a[2] < 0 ? -angle : angle) + 2 * Math.PI - ε) % (2 * Math.PI);
}
d3.geo.distance = function (a, b) {
var Δλ = (b[0] - a[0]) * d3_radians, φ0 = a[1] * d3_radians, φ1 = b[1] * d3_radians, sinΔλ = Math.sin(Δλ), cosΔλ = Math.cos(Δλ), sinφ0 = Math.sin(φ0), cosφ0 = Math.cos(φ0), sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1), t;
return Math.atan2(Math.sqrt((t = cosφ1 * sinΔλ) * t + (t = cosφ0 * sinφ1 - sinφ0 * cosφ1 * cosΔλ) * t), sinφ0 * sinφ1 + cosφ0 * cosφ1 * cosΔλ);
};
d3.geo.graticule = function () {
var x1, x0, X1, X0, y1, y0, Y1, Y0, dx = 10, dy = dx, DX = 90, DY = 360, x, y, X, Y, precision = 2.5;
function graticule() {
return {
type: 'MultiLineString',
coordinates: lines()
};
}
function lines() {
return d3.range(Math.ceil(X0 / DX) * DX, X1, DX).map(X).concat(d3.range(Math.ceil(Y0 / DY) * DY, Y1, DY).map(Y)).concat(d3.range(Math.ceil(x0 / dx) * dx, x1, dx).filter(function (x) {
return abs(x % DX) > ε;
}).map(x)).concat(d3.range(Math.ceil(y0 / dy) * dy, y1, dy).filter(function (y) {
return abs(y % DY) > ε;
}).map(y));
}
graticule.lines = function () {
return lines().map(function (coordinates) {
return {
type: 'LineString',
coordinates: coordinates
};
});
};
graticule.outline = function () {
return {
type: 'Polygon',
coordinates: [X(X0).concat(Y(Y1).slice(1), X(X1).reverse().slice(1), Y(Y0).reverse().slice(1))]
};
};
graticule.extent = function (_) {
if (!arguments.length)
return graticule.minorExtent();
return graticule.majorExtent(_).minorExtent(_);
};
graticule.majorExtent = function (_) {
if (!arguments.length)
return [
[
X0,
Y0
],
[
X1,
Y1
]
];
X0 = +_[0][0], X1 = +_[1][0];
Y0 = +_[0][1], Y1 = +_[1][1];
if (X0 > X1)
_ = X0, X0 = X1, X1 = _;
if (Y0 > Y1)
_ = Y0, Y0 = Y1, Y1 = _;
return graticule.precision(precision);
};
graticule.minorExtent = function (_) {
if (!arguments.length)
return [
[
x0,
y0
],
[
x1,
y1
]
];
x0 = +_[0][0], x1 = +_[1][0];
y0 = +_[0][1], y1 = +_[1][1];
if (x0 > x1)
_ = x0, x0 = x1, x1 = _;
if (y0 > y1)
_ = y0, y0 = y1, y1 = _;
return graticule.precision(precision);
};
graticule.step = function (_) {
if (!arguments.length)
return graticule.minorStep();
return graticule.majorStep(_).minorStep(_);
};
graticule.majorStep = function (_) {
if (!arguments.length)
return [
DX,
DY
];
DX = +_[0], DY = +_[1];
return graticule;
};
graticule.minorStep = function (_) {
if (!arguments.length)
return [
dx,
dy
];
dx = +_[0], dy = +_[1];
return graticule;
};
graticule.precision = function (_) {
if (!arguments.length)
return precision;
precision = +_;
x = d3_geo_graticuleX(y0, y1, 90);
y = d3_geo_graticuleY(x0, x1, precision);
X = d3_geo_graticuleX(Y0, Y1, 90);
Y = d3_geo_graticuleY(X0, X1, precision);
return graticule;
};
return graticule.majorExtent([
[
-180,
-90 + ε
],
[
180,
90 - ε
]
]).minorExtent([
[
-180,
-80 - ε
],
[
180,
80 + ε
]
]);
};
function d3_geo_graticuleX(y0, y1, dy) {
var y = d3.range(y0, y1 - ε, dy).concat(y1);
return function (x) {
return y.map(function (y) {
return [
x,
y
];
});
};
}
function d3_geo_graticuleY(x0, x1, dx) {
var x = d3.range(x0, x1 - ε, dx).concat(x1);
return function (y) {
return x.map(function (x) {
return [
x,
y
];
});
};
}
function d3_source(d) {
return d.source;
}
function d3_target(d) {
return d.target;
}
d3.geo.greatArc = function () {
var source = d3_source, source_, target = d3_target, target_;
function greatArc() {
return {
type: 'LineString',
coordinates: [
source_ || source.apply(this, arguments),
target_ || target.apply(this, arguments)
]
};
}
greatArc.distance = function () {
return d3.geo.distance(source_ || source.apply(this, arguments), target_ || target.apply(this, arguments));
};
greatArc.source = function (_) {
if (!arguments.length)
return source;
source = _, source_ = typeof _ === 'function' ? null : _;
return greatArc;
};
greatArc.target = function (_) {
if (!arguments.length)
return target;
target = _, target_ = typeof _ === 'function' ? null : _;
return greatArc;
};
greatArc.precision = function () {
return arguments.length ? greatArc : 0;
};
return greatArc;
};
d3.geo.interpolate = function (source, target) {
return d3_geo_interpolate(source[0] * d3_radians, source[1] * d3_radians, target[0] * d3_radians, target[1] * d3_radians);
};
function d3_geo_interpolate(x0, y0, x1, y1) {
var cy0 = Math.cos(y0), sy0 = Math.sin(y0), cy1 = Math.cos(y1), sy1 = Math.sin(y1), kx0 = cy0 * Math.cos(x0), ky0 = cy0 * Math.sin(x0), kx1 = cy1 * Math.cos(x1), ky1 = cy1 * Math.sin(x1), d = 2 * Math.asin(Math.sqrt(d3_haversin(y1 - y0) + cy0 * cy1 * d3_haversin(x1 - x0))), k = 1 / Math.sin(d);
var interpolate = d ? function (t) {
var B = Math.sin(t *= d) * k, A = Math.sin(d - t) * k, x = A * kx0 + B * kx1, y = A * ky0 + B * ky1, z = A * sy0 + B * sy1;
return [
Math.atan2(y, x) * d3_degrees,
Math.atan2(z, Math.sqrt(x * x + y * y)) * d3_degrees
];
} : function () {
return [
x0 * d3_degrees,
y0 * d3_degrees
];
};
interpolate.distance = d;
return interpolate;
}
d3.geo.length = function (object) {
d3_geo_lengthSum = 0;
d3.geo.stream(object, d3_geo_length);
return d3_geo_lengthSum;
};
var d3_geo_lengthSum;
var d3_geo_length = {
sphere: d3_noop,
point: d3_noop,
lineStart: d3_geo_lengthLineStart,
lineEnd: d3_noop,
polygonStart: d3_noop,
polygonEnd: d3_noop
};
function d3_geo_lengthLineStart() {
var λ0, sinφ0, cosφ0;
d3_geo_length.point = function (λ, φ) {
λ0 = λ * d3_radians, sinφ0 = Math.sin(φ *= d3_radians), cosφ0 = Math.cos(φ);
d3_geo_length.point = nextPoint;
};
d3_geo_length.lineEnd = function () {
d3_geo_length.point = d3_geo_length.lineEnd = d3_noop;
};
function nextPoint(λ, φ) {
var sinφ = Math.sin(φ *= d3_radians), cosφ = Math.cos(φ), t = abs((λ *= d3_radians) - λ0), cosΔλ = Math.cos(t);
d3_geo_lengthSum += Math.atan2(Math.sqrt((t = cosφ * Math.sin(t)) * t + (t = cosφ0 * sinφ - sinφ0 * cosφ * cosΔλ) * t), sinφ0 * sinφ + cosφ0 * cosφ * cosΔλ);
λ0 = λ, sinφ0 = sinφ, cosφ0 = cosφ;
}
}
function d3_geo_azimuthal(scale, angle) {
function azimuthal(λ, φ) {
var cosλ = Math.cos(λ), cosφ = Math.cos(φ), k = scale(cosλ * cosφ);
return [
k * cosφ * Math.sin(λ),
k * Math.sin(φ)
];
}
azimuthal.invert = function (x, y) {
var ρ = Math.sqrt(x * x + y * y), c = angle(ρ), sinc = Math.sin(c), cosc = Math.cos(c);
return [
Math.atan2(x * sinc, ρ * cosc),
Math.asin(ρ && y * sinc / ρ)
];
};
return azimuthal;
}
var d3_geo_azimuthalEqualArea = d3_geo_azimuthal(function (cosλcosφ) {
return Math.sqrt(2 / (1 + cosλcosφ));
}, function (ρ) {
return 2 * Math.asin(ρ / 2);
});
(d3.geo.azimuthalEqualArea = function () {
return d3_geo_projection(d3_geo_azimuthalEqualArea);
}).raw = d3_geo_azimuthalEqualArea;
var d3_geo_azimuthalEquidistant = d3_geo_azimuthal(function (cosλcosφ) {
var c = Math.acos(cosλcosφ);
return c && c / Math.sin(c);
}, d3_identity);
(d3.geo.azimuthalEquidistant = function () {
return d3_geo_projection(d3_geo_azimuthalEquidistant);
}).raw = d3_geo_azimuthalEquidistant;
function d3_geo_conicConformal(φ0, φ1) {
var cosφ0 = Math.cos(φ0), t = function (φ) {
return Math.tan(π / 4 + φ / 2);
}, n = φ0 === φ1 ? Math.sin(φ0) : Math.log(cosφ0 / Math.cos(φ1)) / Math.log(t(φ1) / t(φ0)), F = cosφ0 * Math.pow(t(φ0), n) / n;
if (!n)
return d3_geo_mercator;
function forward(λ, φ) {
if (F > 0) {
if (φ < -halfπ + ε)
φ = -halfπ + ε;
} else {
if (φ > halfπ - ε)
φ = halfπ - ε;
}
var ρ = F / Math.pow(t(φ), n);
return [
ρ * Math.sin(n * λ),
F - ρ * Math.cos(n * λ)
];
}
forward.invert = function (x, y) {
var ρ0_y = F - y, ρ = d3_sgn(n) * Math.sqrt(x * x + ρ0_y * ρ0_y);
return [
Math.atan2(x, ρ0_y) / n,
2 * Math.atan(Math.pow(F / ρ, 1 / n)) - halfπ
];
};
return forward;
}
(d3.geo.conicConformal = function () {
return d3_geo_conic(d3_geo_conicConformal);
}).raw = d3_geo_conicConformal;
function d3_geo_conicEquidistant(φ0, φ1) {
var cosφ0 = Math.cos(φ0), n = φ0 === φ1 ? Math.sin(φ0) : (cosφ0 - Math.cos(φ1)) / (φ1 - φ0), G = cosφ0 / n + φ0;
if (abs(n) < ε)
return d3_geo_equirectangular;
function forward(λ, φ) {
var ρ = G - φ;
return [
ρ * Math.sin(n * λ),
G - ρ * Math.cos(n * λ)
];
}
forward.invert = function (x, y) {
var ρ0_y = G - y;
return [
Math.atan2(x, ρ0_y) / n,
G - d3_sgn(n) * Math.sqrt(x * x + ρ0_y * ρ0_y)
];
};
return forward;
}
(d3.geo.conicEquidistant = function () {
return d3_geo_conic(d3_geo_conicEquidistant);
}).raw = d3_geo_conicEquidistant;
var d3_geo_gnomonic = d3_geo_azimuthal(function (cosλcosφ) {
return 1 / cosλcosφ;
}, Math.atan);
(d3.geo.gnomonic = function () {
return d3_geo_projection(d3_geo_gnomonic);
}).raw = d3_geo_gnomonic;
function d3_geo_mercator(λ, φ) {
return [
λ,
Math.log(Math.tan(π / 4 + φ / 2))
];
}
d3_geo_mercator.invert = function (x, y) {
return [
x,
2 * Math.atan(Math.exp(y)) - halfπ
];
};
function d3_geo_mercatorProjection(project) {
var m = d3_geo_projection(project), scale = m.scale, translate = m.translate, clipExtent = m.clipExtent, clipAuto;
m.scale = function () {
var v = scale.apply(m, arguments);
return v === m ? clipAuto ? m.clipExtent(null) : m : v;
};
m.translate = function () {
var v = translate.apply(m, arguments);
return v === m ? clipAuto ? m.clipExtent(null) : m : v;
};
m.clipExtent = function (_) {
var v = clipExtent.apply(m, arguments);
if (v === m) {
if (clipAuto = _ == null) {
var k = π * scale(), t = translate();
clipExtent([
[
t[0] - k,
t[1] - k
],
[
t[0] + k,
t[1] + k
]
]);
}
} else if (clipAuto) {
v = null;
}
return v;
};
return m.clipExtent(null);
}
(d3.geo.mercator = function () {
return d3_geo_mercatorProjection(d3_geo_mercator);
}).raw = d3_geo_mercator;
var d3_geo_orthographic = d3_geo_azimuthal(function () {
return 1;
}, Math.asin);
(d3.geo.orthographic = function () {
return d3_geo_projection(d3_geo_orthographic);
}).raw = d3_geo_orthographic;
var d3_geo_stereographic = d3_geo_azimuthal(function (cosλcosφ) {
return 1 / (1 + cosλcosφ);
}, function (ρ) {
return 2 * Math.atan(ρ);
});
(d3.geo.stereographic = function () {
return d3_geo_projection(d3_geo_stereographic);
}).raw = d3_geo_stereographic;
function d3_geo_transverseMercator(λ, φ) {
return [
Math.log(Math.tan(π / 4 + φ / 2)),
-λ
];
}
d3_geo_transverseMercator.invert = function (x, y) {
return [
-y,
2 * Math.atan(Math.exp(x)) - halfπ
];
};
(d3.geo.transverseMercator = function () {
var projection = d3_geo_mercatorProjection(d3_geo_transverseMercator), center = projection.center, rotate = projection.rotate;
projection.center = function (_) {
return _ ? center([
-_[1],
_[0]
]) : (_ = center(), [
_[1],
-_[0]
]);
};
projection.rotate = function (_) {
return _ ? rotate([
_[0],
_[1],
_.length > 2 ? _[2] + 90 : 90
]) : (_ = rotate(), [
_[0],
_[1],
_[2] - 90
]);
};
return rotate([
0,
0,
90
]);
}).raw = d3_geo_transverseMercator;
d3.geom = {};
function d3_geom_pointX(d) {
return d[0];
}
function d3_geom_pointY(d) {
return d[1];
}
d3.geom.hull = function (vertices) {
var x = d3_geom_pointX, y = d3_geom_pointY;
if (arguments.length)
return hull(vertices);
function hull(data) {
if (data.length < 3)
return [];
var fx = d3_functor(x), fy = d3_functor(y), i, n = data.length, points = [], flippedPoints = [];
for (i = 0; i < n; i++) {
points.push([
+fx.call(this, data[i], i),
+fy.call(this, data[i], i),
i
]);
}
points.sort(d3_geom_hullOrder);
for (i = 0; i < n; i++)
flippedPoints.push([
points[i][0],
-points[i][1]
]);
var upper = d3_geom_hullUpper(points), lower = d3_geom_hullUpper(flippedPoints);
var skipLeft = lower[0] === upper[0], skipRight = lower[lower.length - 1] === upper[upper.length - 1], polygon = [];
for (i = upper.length - 1; i >= 0; --i)
polygon.push(data[points[upper[i]][2]]);
for (i = +skipLeft; i < lower.length - skipRight; ++i)
polygon.push(data[points[lower[i]][2]]);
return polygon;
}
hull.x = function (_) {
return arguments.length ? (x = _, hull) : x;
};
hull.y = function (_) {
return arguments.length ? (y = _, hull) : y;
};
return hull;
};
function d3_geom_hullUpper(points) {
var n = points.length, hull = [
0,
1
], hs = 2;
for (var i = 2; i < n; i++) {
while (hs > 1 && d3_cross2d(points[hull[hs - 2]], points[hull[hs - 1]], points[i]) <= 0)
--hs;
hull[hs++] = i;
}
return hull.slice(0, hs);
}
function d3_geom_hullOrder(a, b) {
return a[0] - b[0] || a[1] - b[1];
}
d3.geom.polygon = function (coordinates) {
d3_subclass(coordinates, d3_geom_polygonPrototype);
return coordinates;
};
var d3_geom_polygonPrototype = d3.geom.polygon.prototype = [];
d3_geom_polygonPrototype.area = function () {
var i = -1, n = this.length, a, b = this[n - 1], area = 0;
while (++i < n) {
a = b;
b = this[i];
area += a[1] * b[0] - a[0] * b[1];
}
return area * 0.5;
};
d3_geom_polygonPrototype.centroid = function (k) {
var i = -1, n = this.length, x = 0, y = 0, a, b = this[n - 1], c;
if (!arguments.length)
k = -1 / (6 * this.area());
while (++i < n) {
a = b;
b = this[i];
c = a[0] * b[1] - b[0] * a[1];
x += (a[0] + b[0]) * c;
y += (a[1] + b[1]) * c;
}
return [
x * k,
y * k
];
};
d3_geom_polygonPrototype.clip = function (subject) {
var input, closed = d3_geom_polygonClosed(subject), i = -1, n = this.length - d3_geom_polygonClosed(this), j, m, a = this[n - 1], b, c, d;
while (++i < n) {
input = subject.slice();
subject.length = 0;
b = this[i];
c = input[(m = input.length - closed) - 1];
j = -1;
while (++j < m) {
d = input[j];
if (d3_geom_polygonInside(d, a, b)) {
if (!d3_geom_polygonInside(c, a, b)) {
subject.push(d3_geom_polygonIntersect(c, d, a, b));
}
subject.push(d);
} else if (d3_geom_polygonInside(c, a, b)) {
subject.push(d3_geom_polygonIntersect(c, d, a, b));
}
c = d;
}
if (closed)
subject.push(subject[0]);
a = b;
}
return subject;
};
function d3_geom_polygonInside(p, a, b) {
return (b[0] - a[0]) * (p[1] - a[1]) < (b[1] - a[1]) * (p[0] - a[0]);
}
function d3_geom_polygonIntersect(c, d, a, b) {
var x1 = c[0], x3 = a[0], x21 = d[0] - x1, x43 = b[0] - x3, y1 = c[1], y3 = a[1], y21 = d[1] - y1, y43 = b[1] - y3, ua = (x43 * (y1 - y3) - y43 * (x1 - x3)) / (y43 * x21 - x43 * y21);
return [
x1 + ua * x21,
y1 + ua * y21
];
}
function d3_geom_polygonClosed(coordinates) {
var a = coordinates[0], b = coordinates[coordinates.length - 1];
return !(a[0] - b[0] || a[1] - b[1]);
}
var d3_geom_voronoiEdges, d3_geom_voronoiCells, d3_geom_voronoiBeaches, d3_geom_voronoiBeachPool = [], d3_geom_voronoiFirstCircle, d3_geom_voronoiCircles, d3_geom_voronoiCirclePool = [];
function d3_geom_voronoiBeach() {
d3_geom_voronoiRedBlackNode(this);
this.edge = this.site = this.circle = null;
}
function d3_geom_voronoiCreateBeach(site) {
var beach = d3_geom_voronoiBeachPool.pop() || new d3_geom_voronoiBeach();
beach.site = site;
return beach;
}
function d3_geom_voronoiDetachBeach(beach) {
d3_geom_voronoiDetachCircle(beach);
d3_geom_voronoiBeaches.remove(beach);
d3_geom_voronoiBeachPool.push(beach);
d3_geom_voronoiRedBlackNode(beach);
}
function d3_geom_voronoiRemoveBeach(beach) {
var circle = beach.circle, x = circle.x, y = circle.cy, vertex = {
x: x,
y: y
}, previous = beach.P, next = beach.N, disappearing = [beach];
d3_geom_voronoiDetachBeach(beach);
var lArc = previous;
while (lArc.circle && abs(x - lArc.circle.x) < ε && abs(y - lArc.circle.cy) < ε) {
previous = lArc.P;
disappearing.unshift(lArc);
d3_geom_voronoiDetachBeach(lArc);
lArc = previous;
}
disappearing.unshift(lArc);
d3_geom_voronoiDetachCircle(lArc);
var rArc = next;
while (rArc.circle && abs(x - rArc.circle.x) < ε && abs(y - rArc.circle.cy) < ε) {
next = rArc.N;
disappearing.push(rArc);
d3_geom_voronoiDetachBeach(rArc);
rArc = next;
}
disappearing.push(rArc);
d3_geom_voronoiDetachCircle(rArc);
var nArcs = disappearing.length, iArc;
for (iArc = 1; iArc < nArcs; ++iArc) {
rArc = disappearing[iArc];
lArc = disappearing[iArc - 1];
d3_geom_voronoiSetEdgeEnd(rArc.edge, lArc.site, rArc.site, vertex);
}
lArc = disappearing[0];
rArc = disappearing[nArcs - 1];
rArc.edge = d3_geom_voronoiCreateEdge(lArc.site, rArc.site, null, vertex);
d3_geom_voronoiAttachCircle(lArc);
d3_geom_voronoiAttachCircle(rArc);
}
function d3_geom_voronoiAddBeach(site) {
var x = site.x, directrix = site.y, lArc, rArc, dxl, dxr, node = d3_geom_voronoiBeaches._;
while (node) {
dxl = d3_geom_voronoiLeftBreakPoint(node, directrix) - x;
if (dxl > ε)
node = node.L;
else {
dxr = x - d3_geom_voronoiRightBreakPoint(node, directrix);
if (dxr > ε) {
if (!node.R) {
lArc = node;
break;
}
node = node.R;
} else {
if (dxl > -ε) {
lArc = node.P;
rArc = node;
} else if (dxr > -ε) {
lArc = node;
rArc = node.N;
} else {
lArc = rArc = node;
}
break;
}
}
}
var newArc = d3_geom_voronoiCreateBeach(site);
d3_geom_voronoiBeaches.insert(lArc, newArc);
if (!lArc && !rArc)
return;
if (lArc === rArc) {
d3_geom_voronoiDetachCircle(lArc);
rArc = d3_geom_voronoiCreateBeach(lArc.site);
d3_geom_voronoiBeaches.insert(newArc, rArc);
newArc.edge = rArc.edge = d3_geom_voronoiCreateEdge(lArc.site, newArc.site);
d3_geom_voronoiAttachCircle(lArc);
d3_geom_voronoiAttachCircle(rArc);
return;
}
if (!rArc) {
newArc.edge = d3_geom_voronoiCreateEdge(lArc.site, newArc.site);
return;
}
d3_geom_voronoiDetachCircle(lArc);
d3_geom_voronoiDetachCircle(rArc);
var lSite = lArc.site, ax = lSite.x, ay = lSite.y, bx = site.x - ax, by = site.y - ay, rSite = rArc.site, cx = rSite.x - ax, cy = rSite.y - ay, d = 2 * (bx * cy - by * cx), hb = bx * bx + by * by, hc = cx * cx + cy * cy, vertex = {
x: (cy * hb - by * hc) / d + ax,
y: (bx * hc - cx * hb) / d + ay
};
d3_geom_voronoiSetEdgeEnd(rArc.edge, lSite, rSite, vertex);
newArc.edge = d3_geom_voronoiCreateEdge(lSite, site, null, vertex);
rArc.edge = d3_geom_voronoiCreateEdge(site, rSite, null, vertex);
d3_geom_voronoiAttachCircle(lArc);
d3_geom_voronoiAttachCircle(rArc);
}
function d3_geom_voronoiLeftBreakPoint(arc, directrix) {
var site = arc.site, rfocx = site.x, rfocy = site.y, pby2 = rfocy - directrix;
if (!pby2)
return rfocx;
var lArc = arc.P;
if (!lArc)
return -Infinity;
site = lArc.site;
var lfocx = site.x, lfocy = site.y, plby2 = lfocy - directrix;
if (!plby2)
return lfocx;
var hl = lfocx - rfocx, aby2 = 1 / pby2 - 1 / plby2, b = hl / plby2;
if (aby2)
return (-b + Math.sqrt(b * b - 2 * aby2 * (hl * hl / (-2 * plby2) - lfocy + plby2 / 2 + rfocy - pby2 / 2))) / aby2 + rfocx;
return (rfocx + lfocx) / 2;
}
function d3_geom_voronoiRightBreakPoint(arc, directrix) {
var rArc = arc.N;
if (rArc)
return d3_geom_voronoiLeftBreakPoint(rArc, directrix);
var site = arc.site;
return site.y === directrix ? site.x : Infinity;
}
function d3_geom_voronoiCell(site) {
this.site = site;
this.edges = [];
}
d3_geom_voronoiCell.prototype.prepare = function () {
var halfEdges = this.edges, iHalfEdge = halfEdges.length, edge;
while (iHalfEdge--) {
edge = halfEdges[iHalfEdge].edge;
if (!edge.b || !edge.a)
halfEdges.splice(iHalfEdge, 1);
}
halfEdges.sort(d3_geom_voronoiHalfEdgeOrder);
return halfEdges.length;
};
function d3_geom_voronoiCloseCells(extent) {
var x0 = extent[0][0], x1 = extent[1][0], y0 = extent[0][1], y1 = extent[1][1], x2, y2, x3, y3, cells = d3_geom_voronoiCells, iCell = cells.length, cell, iHalfEdge, halfEdges, nHalfEdges, start, end;
while (iCell--) {
cell = cells[iCell];
if (!cell || !cell.prepare())
continue;
halfEdges = cell.edges;
nHalfEdges = halfEdges.length;
iHalfEdge = 0;
while (iHalfEdge < nHalfEdges) {
end = halfEdges[iHalfEdge].end(), x3 = end.x, y3 = end.y;
start = halfEdges[++iHalfEdge % nHalfEdges].start(), x2 = start.x, y2 = start.y;
if (abs(x3 - x2) > ε || abs(y3 - y2) > ε) {
halfEdges.splice(iHalfEdge, 0, new d3_geom_voronoiHalfEdge(d3_geom_voronoiCreateBorderEdge(cell.site, end, abs(x3 - x0) < ε && y1 - y3 > ε ? {
x: x0,
y: abs(x2 - x0) < ε ? y2 : y1
} : abs(y3 - y1) < ε && x1 - x3 > ε ? {
x: abs(y2 - y1) < ε ? x2 : x1,
y: y1
} : abs(x3 - x1) < ε && y3 - y0 > ε ? {
x: x1,
y: abs(x2 - x1) < ε ? y2 : y0
} : abs(y3 - y0) < ε && x3 - x0 > ε ? {
x: abs(y2 - y0) < ε ? x2 : x0,
y: y0
} : null), cell.site, null));
++nHalfEdges;
}
}
}
}
function d3_geom_voronoiHalfEdgeOrder(a, b) {
return b.angle - a.angle;
}
function d3_geom_voronoiCircle() {
d3_geom_voronoiRedBlackNode(this);
this.x = this.y = this.arc = this.site = this.cy = null;
}
function d3_geom_voronoiAttachCircle(arc) {
var lArc = arc.P, rArc = arc.N;
if (!lArc || !rArc)
return;
var lSite = lArc.site, cSite = arc.site, rSite = rArc.site;
if (lSite === rSite)
return;
var bx = cSite.x, by = cSite.y, ax = lSite.x - bx, ay = lSite.y - by, cx = rSite.x - bx, cy = rSite.y - by;
var d = 2 * (ax * cy - ay * cx);
if (d >= -ε2)
return;
var ha = ax * ax + ay * ay, hc = cx * cx + cy * cy, x = (cy * ha - ay * hc) / d, y = (ax * hc - cx * ha) / d, cy = y + by;
var circle = d3_geom_voronoiCirclePool.pop() || new d3_geom_voronoiCircle();
circle.arc = arc;
circle.site = cSite;
circle.x = x + bx;
circle.y = cy + Math.sqrt(x * x + y * y);
circle.cy = cy;
arc.circle = circle;
var before = null, node = d3_geom_voronoiCircles._;
while (node) {
if (circle.y < node.y || circle.y === node.y && circle.x <= node.x) {
if (node.L)
node = node.L;
else {
before = node.P;
break;
}
} else {
if (node.R)
node = node.R;
else {
before = node;
break;
}
}
}
d3_geom_voronoiCircles.insert(before, circle);
if (!before)
d3_geom_voronoiFirstCircle = circle;
}
function d3_geom_voronoiDetachCircle(arc) {
var circle = arc.circle;
if (circle) {
if (!circle.P)
d3_geom_voronoiFirstCircle = circle.N;
d3_geom_voronoiCircles.remove(circle);
d3_geom_voronoiCirclePool.push(circle);
d3_geom_voronoiRedBlackNode(circle);
arc.circle = null;
}
}
function d3_geom_voronoiClipEdges(extent) {
var edges = d3_geom_voronoiEdges, clip = d3_geom_clipLine(extent[0][0], extent[0][1], extent[1][0], extent[1][1]), i = edges.length, e;
while (i--) {
e = edges[i];
if (!d3_geom_voronoiConnectEdge(e, extent) || !clip(e) || abs(e.a.x - e.b.x) < ε && abs(e.a.y - e.b.y) < ε) {
e.a = e.b = null;
edges.splice(i, 1);
}
}
}
function d3_geom_voronoiConnectEdge(edge, extent) {
var vb = edge.b;
if (vb)
return true;
var va = edge.a, x0 = extent[0][0], x1 = extent[1][0], y0 = extent[0][1], y1 = extent[1][1], lSite = edge.l, rSite = edge.r, lx = lSite.x, ly = lSite.y, rx = rSite.x, ry = rSite.y, fx = (lx + rx) / 2, fy = (ly + ry) / 2, fm, fb;
if (ry === ly) {
if (fx < x0 || fx >= x1)
return;
if (lx > rx) {
if (!va)
va = {
x: fx,
y: y0
};
else if (va.y >= y1)
return;
vb = {
x: fx,
y: y1
};
} else {
if (!va)
va = {
x: fx,
y: y1
};
else if (va.y < y0)
return;
vb = {
x: fx,
y: y0
};
}
} else {
fm = (lx - rx) / (ry - ly);
fb = fy - fm * fx;
if (fm < -1 || fm > 1) {
if (lx > rx) {
if (!va)
va = {
x: (y0 - fb) / fm,
y: y0
};
else if (va.y >= y1)
return;
vb = {
x: (y1 - fb) / fm,
y: y1
};
} else {
if (!va)
va = {
x: (y1 - fb) / fm,
y: y1
};
else if (va.y < y0)
return;
vb = {
x: (y0 - fb) / fm,
y: y0
};
}
} else {
if (ly < ry) {
if (!va)
va = {
x: x0,
y: fm * x0 + fb
};
else if (va.x >= x1)
return;
vb = {
x: x1,
y: fm * x1 + fb
};
} else {
if (!va)
va = {
x: x1,
y: fm * x1 + fb
};
else if (va.x < x0)
return;
vb = {
x: x0,
y: fm * x0 + fb
};
}
}
}
edge.a = va;
edge.b = vb;
return true;
}
function d3_geom_voronoiEdge(lSite, rSite) {
this.l = lSite;
this.r = rSite;
this.a = this.b = null;
}
function d3_geom_voronoiCreateEdge(lSite, rSite, va, vb) {
var edge = new d3_geom_voronoiEdge(lSite, rSite);
d3_geom_voronoiEdges.push(edge);
if (va)
d3_geom_voronoiSetEdgeEnd(edge, lSite, rSite, va);
if (vb)
d3_geom_voronoiSetEdgeEnd(edge, rSite, lSite, vb);
d3_geom_voronoiCells[lSite.i].edges.push(new d3_geom_voronoiHalfEdge(edge, lSite, rSite));
d3_geom_voronoiCells[rSite.i].edges.push(new d3_geom_voronoiHalfEdge(edge, rSite, lSite));
return edge;
}
function d3_geom_voronoiCreateBorderEdge(lSite, va, vb) {
var edge = new d3_geom_voronoiEdge(lSite, null);
edge.a = va;
edge.b = vb;
d3_geom_voronoiEdges.push(edge);
return edge;
}
function d3_geom_voronoiSetEdgeEnd(edge, lSite, rSite, vertex) {
if (!edge.a && !edge.b) {
edge.a = vertex;
edge.l = lSite;
edge.r = rSite;
} else if (edge.l === rSite) {
edge.b = vertex;
} else {
edge.a = vertex;
}
}
function d3_geom_voronoiHalfEdge(edge, lSite, rSite) {
var va = edge.a, vb = edge.b;
this.edge = edge;
this.site = lSite;
this.angle = rSite ? Math.atan2(rSite.y - lSite.y, rSite.x - lSite.x) : edge.l === lSite ? Math.atan2(vb.x - va.x, va.y - vb.y) : Math.atan2(va.x - vb.x, vb.y - va.y);
}
d3_geom_voronoiHalfEdge.prototype = {
start: function () {
return this.edge.l === this.site ? this.edge.a : this.edge.b;
},
end: function () {
return this.edge.l === this.site ? this.edge.b : this.edge.a;
}
};
function d3_geom_voronoiRedBlackTree() {
this._ = null;
}
function d3_geom_voronoiRedBlackNode(node) {
node.U = node.C = node.L = node.R = node.P = node.N = null;
}
d3_geom_voronoiRedBlackTree.prototype = {
insert: function (after, node) {
var parent, grandpa, uncle;
if (after) {
node.P = after;
node.N = after.N;
if (after.N)
after.N.P = node;
after.N = node;
if (after.R) {
after = after.R;
while (after.L)
after = after.L;
after.L = node;
} else {
after.R = node;
}
parent = after;
} else if (this._) {
after = d3_geom_voronoiRedBlackFirst(this._);
node.P = null;
node.N = after;
after.P = after.L = node;
parent = after;
} else {
node.P = node.N = null;
this._ = node;
parent = null;
}
node.L = node.R = null;
node.U = parent;
node.C = true;
after = node;
while (parent && parent.C) {
grandpa = parent.U;
if (parent === grandpa.L) {
uncle = grandpa.R;
if (uncle && uncle.C) {
parent.C = uncle.C = false;
grandpa.C = true;
after = grandpa;
} else {
if (after === parent.R) {
d3_geom_voronoiRedBlackRotateLeft(this, parent);
after = parent;
parent = after.U;
}
parent.C = false;
grandpa.C = true;
d3_geom_voronoiRedBlackRotateRight(this, grandpa);
}
} else {
uncle = grandpa.L;
if (uncle && uncle.C) {
parent.C = uncle.C = false;
grandpa.C = true;
after = grandpa;
} else {
if (after === parent.L) {
d3_geom_voronoiRedBlackRotateRight(this, parent);
after = parent;
parent = after.U;
}
parent.C = false;
grandpa.C = true;
d3_geom_voronoiRedBlackRotateLeft(this, grandpa);
}
}
parent = after.U;
}
this._.C = false;
},
remove: function (node) {
if (node.N)
node.N.P = node.P;
if (node.P)
node.P.N = node.N;
node.N = node.P = null;
var parent = node.U, sibling, left = node.L, right = node.R, next, red;
if (!left)
next = right;
else if (!right)
next = left;
else
next = d3_geom_voronoiRedBlackFirst(right);
if (parent) {
if (parent.L === node)
parent.L = next;
else
parent.R = next;
} else {
this._ = next;
}
if (left && right) {
red = next.C;
next.C = node.C;
next.L = left;
left.U = next;
if (next !== right) {
parent = next.U;
next.U = node.U;
node = next.R;
parent.L = node;
next.R = right;
right.U = next;
} else {
next.U = parent;
parent = next;
node = next.R;
}
} else {
red = node.C;
node = next;
}
if (node)
node.U = parent;
if (red)
return;
if (node && node.C) {
node.C = false;
return;
}
do {
if (node === this._)
break;
if (node === parent.L) {
sibling = parent.R;
if (sibling.C) {
sibling.C = false;
parent.C = true;
d3_geom_voronoiRedBlackRotateLeft(this, parent);
sibling = parent.R;
}
if (sibling.L && sibling.L.C || sibling.R && sibling.R.C) {
if (!sibling.R || !sibling.R.C) {
sibling.L.C = false;
sibling.C = true;
d3_geom_voronoiRedBlackRotateRight(this, sibling);
sibling = parent.R;
}
sibling.C = parent.C;
parent.C = sibling.R.C = false;
d3_geom_voronoiRedBlackRotateLeft(this, parent);
node = this._;
break;
}
} else {
sibling = parent.L;
if (sibling.C) {
sibling.C = false;
parent.C = true;
d3_geom_voronoiRedBlackRotateRight(this, parent);
sibling = parent.L;
}
if (sibling.L && sibling.L.C || sibling.R && sibling.R.C) {
if (!sibling.L || !sibling.L.C) {
sibling.R.C = false;
sibling.C = true;
d3_geom_voronoiRedBlackRotateLeft(this, sibling);
sibling = parent.L;
}
sibling.C = parent.C;
parent.C = sibling.L.C = false;
d3_geom_voronoiRedBlackRotateRight(this, parent);
node = this._;
break;
}
}
sibling.C = true;
node = parent;
parent = parent.U;
} while (!node.C);
if (node)
node.C = false;
}
};
function d3_geom_voronoiRedBlackRotateLeft(tree, node) {
var p = node, q = node.R, parent = p.U;
if (parent) {
if (parent.L === p)
parent.L = q;
else
parent.R = q;
} else {
tree._ = q;
}
q.U = parent;
p.U = q;
p.R = q.L;
if (p.R)
p.R.U = p;
q.L = p;
}
function d3_geom_voronoiRedBlackRotateRight(tree, node) {
var p = node, q = node.L, parent = p.U;
if (parent) {
if (parent.L === p)
parent.L = q;
else
parent.R = q;
} else {
tree._ = q;
}
q.U = parent;
p.U = q;
p.L = q.R;
if (p.L)
p.L.U = p;
q.R = p;
}
function d3_geom_voronoiRedBlackFirst(node) {
while (node.L)
node = node.L;
return node;
}
function d3_geom_voronoi(sites, bbox) {
var site = sites.sort(d3_geom_voronoiVertexOrder).pop(), x0, y0, circle;
d3_geom_voronoiEdges = [];
d3_geom_voronoiCells = new Array(sites.length);
d3_geom_voronoiBeaches = new d3_geom_voronoiRedBlackTree();
d3_geom_voronoiCircles = new d3_geom_voronoiRedBlackTree();
while (true) {
circle = d3_geom_voronoiFirstCircle;
if (site && (!circle || site.y < circle.y || site.y === circle.y && site.x < circle.x)) {
if (site.x !== x0 || site.y !== y0) {
d3_geom_voronoiCells[site.i] = new d3_geom_voronoiCell(site);
d3_geom_voronoiAddBeach(site);
x0 = site.x, y0 = site.y;
}
site = sites.pop();
} else if (circle) {
d3_geom_voronoiRemoveBeach(circle.arc);
} else {
break;
}
}
if (bbox)
d3_geom_voronoiClipEdges(bbox), d3_geom_voronoiCloseCells(bbox);
var diagram = {
cells: d3_geom_voronoiCells,
edges: d3_geom_voronoiEdges
};
d3_geom_voronoiBeaches = d3_geom_voronoiCircles = d3_geom_voronoiEdges = d3_geom_voronoiCells = null;
return diagram;
}
function d3_geom_voronoiVertexOrder(a, b) {
return b.y - a.y || b.x - a.x;
}
d3.geom.voronoi = function (points) {
var x = d3_geom_pointX, y = d3_geom_pointY, fx = x, fy = y, clipExtent = d3_geom_voronoiClipExtent;
if (points)
return voronoi(points);
function voronoi(data) {
var polygons = new Array(data.length), x0 = clipExtent[0][0], y0 = clipExtent[0][1], x1 = clipExtent[1][0], y1 = clipExtent[1][1];
d3_geom_voronoi(sites(data), clipExtent).cells.forEach(function (cell, i) {
var edges = cell.edges, site = cell.site, polygon = polygons[i] = edges.length ? edges.map(function (e) {
var s = e.start();
return [
s.x,
s.y
];
}) : site.x >= x0 && site.x <= x1 && site.y >= y0 && site.y <= y1 ? [
[
x0,
y1
],
[
x1,
y1
],
[
x1,
y0
],
[
x0,
y0
]
] : [];
polygon.point = data[i];
});
return polygons;
}
function sites(data) {
return data.map(function (d, i) {
return {
x: Math.round(fx(d, i) / ε) * ε,
y: Math.round(fy(d, i) / ε) * ε,
i: i
};
});
}
voronoi.links = function (data) {
return d3_geom_voronoi(sites(data)).edges.filter(function (edge) {
return edge.l && edge.r;
}).map(function (edge) {
return {
source: data[edge.l.i],
target: data[edge.r.i]
};
});
};
voronoi.triangles = function (data) {
var triangles = [];
d3_geom_voronoi(sites(data)).cells.forEach(function (cell, i) {
var site = cell.site, edges = cell.edges.sort(d3_geom_voronoiHalfEdgeOrder), j = -1, m = edges.length, e0, s0, e1 = edges[m - 1].edge, s1 = e1.l === site ? e1.r : e1.l;
while (++j < m) {
e0 = e1;
s0 = s1;
e1 = edges[j].edge;
s1 = e1.l === site ? e1.r : e1.l;
if (i < s0.i && i < s1.i && d3_geom_voronoiTriangleArea(site, s0, s1) < 0) {
triangles.push([
data[i],
data[s0.i],
data[s1.i]
]);
}
}
});
return triangles;
};
voronoi.x = function (_) {
return arguments.length ? (fx = d3_functor(x = _), voronoi) : x;
};
voronoi.y = function (_) {
return arguments.length ? (fy = d3_functor(y = _), voronoi) : y;
};
voronoi.clipExtent = function (_) {
if (!arguments.length)
return clipExtent === d3_geom_voronoiClipExtent ? null : clipExtent;
clipExtent = _ == null ? d3_geom_voronoiClipExtent : _;
return voronoi;
};
voronoi.size = function (_) {
if (!arguments.length)
return clipExtent === d3_geom_voronoiClipExtent ? null : clipExtent && clipExtent[1];
return voronoi.clipExtent(_ && [
[
0,
0
],
_
]);
};
return voronoi;
};
var d3_geom_voronoiClipExtent = [
[
-1000000,
-1000000
],
[
1000000,
1000000
]
];
function d3_geom_voronoiTriangleArea(a, b, c) {
return (a.x - c.x) * (b.y - a.y) - (a.x - b.x) * (c.y - a.y);
}
d3.geom.delaunay = function (vertices) {
return d3.geom.voronoi().triangles(vertices);
};
d3.geom.quadtree = function (points, x1, y1, x2, y2) {
var x = d3_geom_pointX, y = d3_geom_pointY, compat;
if (compat = arguments.length) {
x = d3_geom_quadtreeCompatX;
y = d3_geom_quadtreeCompatY;
if (compat === 3) {
y2 = y1;
x2 = x1;
y1 = x1 = 0;
}
return quadtree(points);
}
function quadtree(data) {
var d, fx = d3_functor(x), fy = d3_functor(y), xs, ys, i, n, x1_, y1_, x2_, y2_;
if (x1 != null) {
x1_ = x1, y1_ = y1, x2_ = x2, y2_ = y2;
} else {
x2_ = y2_ = -(x1_ = y1_ = Infinity);
xs = [], ys = [];
n = data.length;
if (compat)
for (i = 0; i < n; ++i) {
d = data[i];
if (d.x < x1_)
x1_ = d.x;
if (d.y < y1_)
y1_ = d.y;
if (d.x > x2_)
x2_ = d.x;
if (d.y > y2_)
y2_ = d.y;
xs.push(d.x);
ys.push(d.y);
}
else
for (i = 0; i < n; ++i) {
var x_ = +fx(d = data[i], i), y_ = +fy(d, i);
if (x_ < x1_)
x1_ = x_;
if (y_ < y1_)
y1_ = y_;
if (x_ > x2_)
x2_ = x_;
if (y_ > y2_)
y2_ = y_;
xs.push(x_);
ys.push(y_);
}
}
var dx = x2_ - x1_, dy = y2_ - y1_;
if (dx > dy)
y2_ = y1_ + dx;
else
x2_ = x1_ + dy;
function insert(n, d, x, y, x1, y1, x2, y2) {
if (isNaN(x) || isNaN(y))
return;
if (n.leaf) {
var nx = n.x, ny = n.y;
if (nx != null) {
if (abs(nx - x) + abs(ny - y) < 0.01) {
insertChild(n, d, x, y, x1, y1, x2, y2);
} else {
var nPoint = n.point;
n.x = n.y = n.point = null;
insertChild(n, nPoint, nx, ny, x1, y1, x2, y2);
insertChild(n, d, x, y, x1, y1, x2, y2);
}
} else {
n.x = x, n.y = y, n.point = d;
}
} else {
insertChild(n, d, x, y, x1, y1, x2, y2);
}
}
function insertChild(n, d, x, y, x1, y1, x2, y2) {
var xm = (x1 + x2) * 0.5, ym = (y1 + y2) * 0.5, right = x >= xm, below = y >= ym, i = below << 1 | right;
n.leaf = false;
n = n.nodes[i] || (n.nodes[i] = d3_geom_quadtreeNode());
if (right)
x1 = xm;
else
x2 = xm;
if (below)
y1 = ym;
else
y2 = ym;
insert(n, d, x, y, x1, y1, x2, y2);
}
var root = d3_geom_quadtreeNode();
root.add = function (d) {
insert(root, d, +fx(d, ++i), +fy(d, i), x1_, y1_, x2_, y2_);
};
root.visit = function (f) {
d3_geom_quadtreeVisit(f, root, x1_, y1_, x2_, y2_);
};
root.find = function (point) {
return d3_geom_quadtreeFind(root, point[0], point[1], x1_, y1_, x2_, y2_);
};
i = -1;
if (x1 == null) {
while (++i < n) {
insert(root, data[i], xs[i], ys[i], x1_, y1_, x2_, y2_);
}
--i;
} else
data.forEach(root.add);
xs = ys = data = d = null;
return root;
}
quadtree.x = function (_) {
return arguments.length ? (x = _, quadtree) : x;
};
quadtree.y = function (_) {
return arguments.length ? (y = _, quadtree) : y;
};
quadtree.extent = function (_) {
if (!arguments.length)
return x1 == null ? null : [
[
x1,
y1
],
[
x2,
y2
]
];
if (_ == null)
x1 = y1 = x2 = y2 = null;
else
x1 = +_[0][0], y1 = +_[0][1], x2 = +_[1][0], y2 = +_[1][1];
return quadtree;
};
quadtree.size = function (_) {
if (!arguments.length)
return x1 == null ? null : [
x2 - x1,
y2 - y1
];
if (_ == null)
x1 = y1 = x2 = y2 = null;
else
x1 = y1 = 0, x2 = +_[0], y2 = +_[1];
return quadtree;
};
return quadtree;
};
function d3_geom_quadtreeCompatX(d) {
return d.x;
}
function d3_geom_quadtreeCompatY(d) {
return d.y;
}
function d3_geom_quadtreeNode() {
return {
leaf: true,
nodes: [],
point: null,
x: null,
y: null
};
}
function d3_geom_quadtreeVisit(f, node, x1, y1, x2, y2) {
if (!f(node, x1, y1, x2, y2)) {
var sx = (x1 + x2) * 0.5, sy = (y1 + y2) * 0.5, children = node.nodes;
if (children[0])
d3_geom_quadtreeVisit(f, children[0], x1, y1, sx, sy);
if (children[1])
d3_geom_quadtreeVisit(f, children[1], sx, y1, x2, sy);
if (children[2])
d3_geom_quadtreeVisit(f, children[2], x1, sy, sx, y2);
if (children[3])
d3_geom_quadtreeVisit(f, children[3], sx, sy, x2, y2);
}
}
function d3_geom_quadtreeFind(root, x, y, x0, y0, x3, y3) {
var minDistance2 = Infinity, closestPoint;
(function find(node, x1, y1, x2, y2) {
if (x1 > x3 || y1 > y3 || x2 < x0 || y2 < y0)
return;
if (point = node.point) {
var point, dx = x - node.x, dy = y - node.y, distance2 = dx * dx + dy * dy;
if (distance2 < minDistance2) {
var distance = Math.sqrt(minDistance2 = distance2);
x0 = x - distance, y0 = y - distance;
x3 = x + distance, y3 = y + distance;
closestPoint = point;
}
}
var children = node.nodes, xm = (x1 + x2) * 0.5, ym = (y1 + y2) * 0.5, right = x >= xm, below = y >= ym;
for (var i = below << 1 | right, j = i + 4; i < j; ++i) {
if (node = children[i & 3])
switch (i & 3) {
case 0:
find(node, x1, y1, xm, ym);
break;
case 1:
find(node, xm, y1, x2, ym);
break;
case 2:
find(node, x1, ym, xm, y2);
break;
case 3:
find(node, xm, ym, x2, y2);
break;
}
}
}(root, x0, y0, x3, y3));
return closestPoint;
}
d3.interpolateRgb = d3_interpolateRgb;
function d3_interpolateRgb(a, b) {
a = d3.rgb(a);
b = d3.rgb(b);
var ar = a.r, ag = a.g, ab = a.b, br = b.r - ar, bg = b.g - ag, bb = b.b - ab;
return function (t) {
return '#' + d3_rgb_hex(Math.round(ar + br * t)) + d3_rgb_hex(Math.round(ag + bg * t)) + d3_rgb_hex(Math.round(ab + bb * t));
};
}
d3.interpolateObject = d3_interpolateObject;
function d3_interpolateObject(a, b) {
var i = {}, c = {}, k;
for (k in a) {
if (k in b) {
i[k] = d3_interpolate(a[k], b[k]);
} else {
c[k] = a[k];
}
}
for (k in b) {
if (!(k in a)) {
c[k] = b[k];
}
}
return function (t) {
for (k in i)
c[k] = i[k](t);
return c;
};
}
d3.interpolateNumber = d3_interpolateNumber;
function d3_interpolateNumber(a, b) {
a = +a, b = +b;
return function (t) {
return a * (1 - t) + b * t;
};
}
d3.interpolateString = d3_interpolateString;
function d3_interpolateString(a, b) {
var bi = d3_interpolate_numberA.lastIndex = d3_interpolate_numberB.lastIndex = 0, am, bm, bs, i = -1, s = [], q = [];
a = a + '', b = b + '';
while ((am = d3_interpolate_numberA.exec(a)) && (bm = d3_interpolate_numberB.exec(b))) {
if ((bs = bm.index) > bi) {
bs = b.slice(bi, bs);
if (s[i])
s[i] += bs;
else
s[++i] = bs;
}
if ((am = am[0]) === (bm = bm[0])) {
if (s[i])
s[i] += bm;
else
s[++i] = bm;
} else {
s[++i] = null;
q.push({
i: i,
x: d3_interpolateNumber(am, bm)
});
}
bi = d3_interpolate_numberB.lastIndex;
}
if (bi < b.length) {
bs = b.slice(bi);
if (s[i])
s[i] += bs;
else
s[++i] = bs;
}
return s.length < 2 ? q[0] ? (b = q[0].x, function (t) {
return b(t) + '';
}) : function () {
return b;
} : (b = q.length, function (t) {
for (var i = 0, o; i < b; ++i)
s[(o = q[i]).i] = o.x(t);
return s.join('');
});
}
var d3_interpolate_numberA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, d3_interpolate_numberB = new RegExp(d3_interpolate_numberA.source, 'g');
d3.interpolate = d3_interpolate;
function d3_interpolate(a, b) {
var i = d3.interpolators.length, f;
while (--i >= 0 && !(f = d3.interpolators[i](a, b)));
return f;
}
d3.interpolators = [function (a, b) {
var t = typeof b;
return (t === 'string' ? d3_rgb_names.has(b.toLowerCase()) || /^(#|rgb\(|hsl\()/i.test(b) ? d3_interpolateRgb : d3_interpolateString : b instanceof d3_color ? d3_interpolateRgb : Array.isArray(b) ? d3_interpolateArray : t === 'object' && isNaN(b) ? d3_interpolateObject : d3_interpolateNumber)(a, b);
}];
d3.interpolateArray = d3_interpolateArray;
function d3_interpolateArray(a, b) {
var x = [], c = [], na = a.length, nb = b.length, n0 = Math.min(a.length, b.length), i;
for (i = 0; i < n0; ++i)
x.push(d3_interpolate(a[i], b[i]));
for (; i < na; ++i)
c[i] = a[i];
for (; i < nb; ++i)
c[i] = b[i];
return function (t) {
for (i = 0; i < n0; ++i)
c[i] = x[i](t);
return c;
};
}
var d3_ease_default = function () {
return d3_identity;
};
var d3_ease = d3.map({
linear: d3_ease_default,
poly: d3_ease_poly,
quad: function () {
return d3_ease_quad;
},
cubic: function () {
return d3_ease_cubic;
},
sin: function () {
return d3_ease_sin;
},
exp: function () {
return d3_ease_exp;
},
circle: function () {
return d3_ease_circle;
},
elastic: d3_ease_elastic,
back: d3_ease_back,
bounce: function () {
return d3_ease_bounce;
}
});
var d3_ease_mode = d3.map({
'in': d3_identity,
out: d3_ease_reverse,
'in-out': d3_ease_reflect,
'out-in': function (f) {
return d3_ease_reflect(d3_ease_reverse(f));
}
});
d3.ease = function (name) {
var i = name.indexOf('-'), t = i >= 0 ? name.slice(0, i) : name, m = i >= 0 ? name.slice(i + 1) : 'in';
t = d3_ease.get(t) || d3_ease_default;
m = d3_ease_mode.get(m) || d3_identity;
return d3_ease_clamp(m(t.apply(null, d3_arraySlice.call(arguments, 1))));
};
function d3_ease_clamp(f) {
return function (t) {
return t <= 0 ? 0 : t >= 1 ? 1 : f(t);
};
}
function d3_ease_reverse(f) {
return function (t) {
return 1 - f(1 - t);
};
}
function d3_ease_reflect(f) {
return function (t) {
return 0.5 * (t < 0.5 ? f(2 * t) : 2 - f(2 - 2 * t));
};
}
function d3_ease_quad(t) {
return t * t;
}
function d3_ease_cubic(t) {
return t * t * t;
}
function d3_ease_cubicInOut(t) {
if (t <= 0)
return 0;
if (t >= 1)
return 1;
var t2 = t * t, t3 = t2 * t;
return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
}
function d3_ease_poly(e) {
return function (t) {
return Math.pow(t, e);
};
}
function d3_ease_sin(t) {
return 1 - Math.cos(t * halfπ);
}
function d3_ease_exp(t) {
return Math.pow(2, 10 * (t - 1));
}
function d3_ease_circle(t) {
return 1 - Math.sqrt(1 - t * t);
}
function d3_ease_elastic(a, p) {
var s;
if (arguments.length < 2)
p = 0.45;
if (arguments.length)
s = p / τ * Math.asin(1 / a);
else
a = 1, s = p / 4;
return function (t) {
return 1 + a * Math.pow(2, -10 * t) * Math.sin((t - s) * τ / p);
};
}
function d3_ease_back(s) {
if (!s)
s = 1.70158;
return function (t) {
return t * t * ((s + 1) * t - s);
};
}
function d3_ease_bounce(t) {
return t < 1 / 2.75 ? 7.5625 * t * t : t < 2 / 2.75 ? 7.5625 * (t -= 1.5 / 2.75) * t + 0.75 : t < 2.5 / 2.75 ? 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375 : 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}
d3.interpolateHcl = d3_interpolateHcl;
function d3_interpolateHcl(a, b) {
a = d3.hcl(a);
b = d3.hcl(b);
var ah = a.h, ac = a.c, al = a.l, bh = b.h - ah, bc = b.c - ac, bl = b.l - al;
if (isNaN(bc))
bc = 0, ac = isNaN(ac) ? b.c : ac;
if (isNaN(bh))
bh = 0, ah = isNaN(ah) ? b.h : ah;
else if (bh > 180)
bh -= 360;
else if (bh < -180)
bh += 360;
return function (t) {
return d3_hcl_lab(ah + bh * t, ac + bc * t, al + bl * t) + '';
};
}
d3.interpolateHsl = d3_interpolateHsl;
function d3_interpolateHsl(a, b) {
a = d3.hsl(a);
b = d3.hsl(b);
var ah = a.h, as = a.s, al = a.l, bh = b.h - ah, bs = b.s - as, bl = b.l - al;
if (isNaN(bs))
bs = 0, as = isNaN(as) ? b.s : as;
if (isNaN(bh))
bh = 0, ah = isNaN(ah) ? b.h : ah;
else if (bh > 180)
bh -= 360;
else if (bh < -180)
bh += 360;
return function (t) {
return d3_hsl_rgb(ah + bh * t, as + bs * t, al + bl * t) + '';
};
}
d3.interpolateLab = d3_interpolateLab;
function d3_interpolateLab(a, b) {
a = d3.lab(a);
b = d3.lab(b);
var al = a.l, aa = a.a, ab = a.b, bl = b.l - al, ba = b.a - aa, bb = b.b - ab;
return function (t) {
return d3_lab_rgb(al + bl * t, aa + ba * t, ab + bb * t) + '';
};
}
d3.interpolateRound = d3_interpolateRound;
function d3_interpolateRound(a, b) {
b -= a;
return function (t) {
return Math.round(a + b * t);
};
}
d3.transform = function (string) {
var g = d3_document.createElementNS(d3.ns.prefix.svg, 'g');
return (d3.transform = function (string) {
if (string != null) {
g.setAttribute('transform', string);
var t = g.transform.baseVal.consolidate();
}
return new d3_transform(t ? t.matrix : d3_transformIdentity);
})(string);
};
function d3_transform(m) {
var r0 = [
m.a,
m.b
], r1 = [
m.c,
m.d
], kx = d3_transformNormalize(r0), kz = d3_transformDot(r0, r1), ky = d3_transformNormalize(d3_transformCombine(r1, r0, -kz)) || 0;
if (r0[0] * r1[1] < r1[0] * r0[1]) {
r0[0] *= -1;
r0[1] *= -1;
kx *= -1;
kz *= -1;
}
this.rotate = (kx ? Math.atan2(r0[1], r0[0]) : Math.atan2(-r1[0], r1[1])) * d3_degrees;
this.translate = [
m.e,
m.f
];
this.scale = [
kx,
ky
];
this.skew = ky ? Math.atan2(kz, ky) * d3_degrees : 0;
}
d3_transform.prototype.toString = function () {
return 'translate(' + this.translate + ')rotate(' + this.rotate + ')skewX(' + this.skew + ')scale(' + this.scale + ')';
};
function d3_transformDot(a, b) {
return a[0] * b[0] + a[1] * b[1];
}
function d3_transformNormalize(a) {
var k = Math.sqrt(d3_transformDot(a, a));
if (k) {
a[0] /= k;
a[1] /= k;
}
return k;
}
function d3_transformCombine(a, b, k) {
a[0] += k * b[0];
a[1] += k * b[1];
return a;
}
var d3_transformIdentity = {
a: 1,
b: 0,
c: 0,
d: 1,
e: 0,
f: 0
};
d3.interpolateTransform = d3_interpolateTransform;
function d3_interpolateTransformPop(s) {
return s.length ? s.pop() + ',' : '';
}
function d3_interpolateTranslate(ta, tb, s, q) {
if (ta[0] !== tb[0] || ta[1] !== tb[1]) {
var i = s.push('translate(', null, ',', null, ')');
q.push({
i: i - 4,
x: d3_interpolateNumber(ta[0], tb[0])
}, {
i: i - 2,
x: d3_interpolateNumber(ta[1], tb[1])
});
} else if (tb[0] || tb[1]) {
s.push('translate(' + tb + ')');
}
}
function d3_interpolateRotate(ra, rb, s, q) {
if (ra !== rb) {
if (ra - rb > 180)
rb += 360;
else if (rb - ra > 180)
ra += 360;
q.push({
i: s.push(d3_interpolateTransformPop(s) + 'rotate(', null, ')') - 2,
x: d3_interpolateNumber(ra, rb)
});
} else if (rb) {
s.push(d3_interpolateTransformPop(s) + 'rotate(' + rb + ')');
}
}
function d3_interpolateSkew(wa, wb, s, q) {
if (wa !== wb) {
q.push({
i: s.push(d3_interpolateTransformPop(s) + 'skewX(', null, ')') - 2,
x: d3_interpolateNumber(wa, wb)
});
} else if (wb) {
s.push(d3_interpolateTransformPop(s) + 'skewX(' + wb + ')');
}
}
function d3_interpolateScale(ka, kb, s, q) {
if (ka[0] !== kb[0] || ka[1] !== kb[1]) {
var i = s.push(d3_interpolateTransformPop(s) + 'scale(', null, ',', null, ')');
q.push({
i: i - 4,
x: d3_interpolateNumber(ka[0], kb[0])
}, {
i: i - 2,
x: d3_interpolateNumber(ka[1], kb[1])
});
} else if (kb[0] !== 1 || kb[1] !== 1) {
s.push(d3_interpolateTransformPop(s) + 'scale(' + kb + ')');
}
}
function d3_interpolateTransform(a, b) {
var s = [], q = [];
a = d3.transform(a), b = d3.transform(b);
d3_interpolateTranslate(a.translate, b.translate, s, q);
d3_interpolateRotate(a.rotate, b.rotate, s, q);
d3_interpolateSkew(a.skew, b.skew, s, q);
d3_interpolateScale(a.scale, b.scale, s, q);
a = b = null;
return function (t) {
var i = -1, n = q.length, o;
while (++i < n)
s[(o = q[i]).i] = o.x(t);
return s.join('');
};
}
function d3_uninterpolateNumber(a, b) {
b = (b -= a = +a) || 1 / b;
return function (x) {
return (x - a) / b;
};
}
function d3_uninterpolateClamp(a, b) {
b = (b -= a = +a) || 1 / b;
return function (x) {
return Math.max(0, Math.min(1, (x - a) / b));
};
}
d3.layout = {};
d3.layout.bundle = function () {
return function (links) {
var paths = [], i = -1, n = links.length;
while (++i < n)
paths.push(d3_layout_bundlePath(links[i]));
return paths;
};
};
function d3_layout_bundlePath(link) {
var start = link.source, end = link.target, lca = d3_layout_bundleLeastCommonAncestor(start, end), points = [start];
while (start !== lca) {
start = start.parent;
points.push(start);
}
var k = points.length;
while (end !== lca) {
points.splice(k, 0, end);
end = end.parent;
}
return points;
}
function d3_layout_bundleAncestors(node) {
var ancestors = [], parent = node.parent;
while (parent != null) {
ancestors.push(node);
node = parent;
parent = parent.parent;
}
ancestors.push(node);
return ancestors;
}
function d3_layout_bundleLeastCommonAncestor(a, b) {
if (a === b)
return a;
var aNodes = d3_layout_bundleAncestors(a), bNodes = d3_layout_bundleAncestors(b), aNode = aNodes.pop(), bNode = bNodes.pop(), sharedNode = null;
while (aNode === bNode) {
sharedNode = aNode;
aNode = aNodes.pop();
bNode = bNodes.pop();
}
return sharedNode;
}
d3.layout.chord = function () {
var chord = {}, chords, groups, matrix, n, padding = 0, sortGroups, sortSubgroups, sortChords;
function relayout() {
var subgroups = {}, groupSums = [], groupIndex = d3.range(n), subgroupIndex = [], k, x, x0, i, j;
chords = [];
groups = [];
k = 0, i = -1;
while (++i < n) {
x = 0, j = -1;
while (++j < n) {
x += matrix[i][j];
}
groupSums.push(x);
subgroupIndex.push(d3.range(n));
k += x;
}
if (sortGroups) {
groupIndex.sort(function (a, b) {
return sortGroups(groupSums[a], groupSums[b]);
});
}
if (sortSubgroups) {
subgroupIndex.forEach(function (d, i) {
d.sort(function (a, b) {
return sortSubgroups(matrix[i][a], matrix[i][b]);
});
});
}
k = (τ - padding * n) / k;
x = 0, i = -1;
while (++i < n) {
x0 = x, j = -1;
while (++j < n) {
var di = groupIndex[i], dj = subgroupIndex[di][j], v = matrix[di][dj], a0 = x, a1 = x += v * k;
subgroups[di + '-' + dj] = {
index: di,
subindex: dj,
startAngle: a0,
endAngle: a1,
value: v
};
}
groups[di] = {
index: di,
startAngle: x0,
endAngle: x,
value: groupSums[di]
};
x += padding;
}
i = -1;
while (++i < n) {
j = i - 1;
while (++j < n) {
var source = subgroups[i + '-' + j], target = subgroups[j + '-' + i];
if (source.value || target.value) {
chords.push(source.value < target.value ? {
source: target,
target: source
} : {
source: source,
target: target
});
}
}
}
if (sortChords)
resort();
}
function resort() {
chords.sort(function (a, b) {
return sortChords((a.source.value + a.target.value) / 2, (b.source.value + b.target.value) / 2);
});
}
chord.matrix = function (x) {
if (!arguments.length)
return matrix;
n = (matrix = x) && matrix.length;
chords = groups = null;
return chord;
};
chord.padding = function (x) {
if (!arguments.length)
return padding;
padding = x;
chords = groups = null;
return chord;
};
chord.sortGroups = function (x) {
if (!arguments.length)
return sortGroups;
sortGroups = x;
chords = groups = null;
return chord;
};
chord.sortSubgroups = function (x) {
if (!arguments.length)
return sortSubgroups;
sortSubgroups = x;
chords = null;
return chord;
};
chord.sortChords = function (x) {
if (!arguments.length)
return sortChords;
sortChords = x;
if (chords)
resort();
return chord;
};
chord.chords = function () {
if (!chords)
relayout();
return chords;
};
chord.groups = function () {
if (!groups)
relayout();
return groups;
};
return chord;
};
d3.layout.force = function () {
var force = {}, event = d3.dispatch('start', 'tick', 'end'), timer, size = [
1,
1
], drag, alpha, friction = 0.9, linkDistance = d3_layout_forceLinkDistance, linkStrength = d3_layout_forceLinkStrength, charge = -30, chargeDistance2 = d3_layout_forceChargeDistance2, gravity = 0.1, theta2 = 0.64, nodes = [], links = [], distances, strengths, charges;
function repulse(node) {
return function (quad, x1, _, x2) {
if (quad.point !== node) {
var dx = quad.cx - node.x, dy = quad.cy - node.y, dw = x2 - x1, dn = dx * dx + dy * dy;
if (dw * dw / theta2 < dn) {
if (dn < chargeDistance2) {
var k = quad.charge / dn;
node.px -= dx * k;
node.py -= dy * k;
}
return true;
}
if (quad.point && dn && dn < chargeDistance2) {
var k = quad.pointCharge / dn;
node.px -= dx * k;
node.py -= dy * k;
}
}
return !quad.charge;
};
}
force.tick = function () {
if ((alpha *= 0.99) < 0.005) {
timer = null;
event.end({
type: 'end',
alpha: alpha = 0
});
return true;
}
var n = nodes.length, m = links.length, q, i, o, s, t, l, k, x, y;
for (i = 0; i < m; ++i) {
o = links[i];
s = o.source;
t = o.target;
x = t.x - s.x;
y = t.y - s.y;
if (l = x * x + y * y) {
l = alpha * strengths[i] * ((l = Math.sqrt(l)) - distances[i]) / l;
x *= l;
y *= l;
t.x -= x * (k = s.weight + t.weight ? s.weight / (s.weight + t.weight) : 0.5);
t.y -= y * k;
s.x += x * (k = 1 - k);
s.y += y * k;
}
}
if (k = alpha * gravity) {
x = size[0] / 2;
y = size[1] / 2;
i = -1;
if (k)
while (++i < n) {
o = nodes[i];
o.x += (x - o.x) * k;
o.y += (y - o.y) * k;
}
}
if (charge) {
d3_layout_forceAccumulate(q = d3.geom.quadtree(nodes), alpha, charges);
i = -1;
while (++i < n) {
if (!(o = nodes[i]).fixed) {
q.visit(repulse(o));
}
}
}
i = -1;
while (++i < n) {
o = nodes[i];
if (o.fixed) {
o.x = o.px;
o.y = o.py;
} else {
o.x -= (o.px - (o.px = o.x)) * friction;
o.y -= (o.py - (o.py = o.y)) * friction;
}
}
event.tick({
type: 'tick',
alpha: alpha
});
};
force.nodes = function (x) {
if (!arguments.length)
return nodes;
nodes = x;
return force;
};
force.links = function (x) {
if (!arguments.length)
return links;
links = x;
return force;
};
force.size = function (x) {
if (!arguments.length)
return size;
size = x;
return force;
};
force.linkDistance = function (x) {
if (!arguments.length)
return linkDistance;
linkDistance = typeof x === 'function' ? x : +x;
return force;
};
force.distance = force.linkDistance;
force.linkStrength = function (x) {
if (!arguments.length)
return linkStrength;
linkStrength = typeof x === 'function' ? x : +x;
return force;
};
force.friction = function (x) {
if (!arguments.length)
return friction;
friction = +x;
return force;
};
force.charge = function (x) {
if (!arguments.length)
return charge;
charge = typeof x === 'function' ? x : +x;
return force;
};
force.chargeDistance = function (x) {
if (!arguments.length)
return Math.sqrt(chargeDistance2);
chargeDistance2 = x * x;
return force;
};
force.gravity = function (x) {
if (!arguments.length)
return gravity;
gravity = +x;
return force;
};
force.theta = function (x) {
if (!arguments.length)
return Math.sqrt(theta2);
theta2 = x * x;
return force;
};
force.alpha = function (x) {
if (!arguments.length)
return alpha;
x = +x;
if (alpha) {
if (x > 0) {
alpha = x;
} else {
timer.c = null, timer.t = NaN, timer = null;
event.end({
type: 'end',
alpha: alpha = 0
});
}
} else if (x > 0) {
event.start({
type: 'start',
alpha: alpha = x
});
timer = d3_timer(force.tick);
}
return force;
};
force.start = function () {
var i, n = nodes.length, m = links.length, w = size[0], h = size[1], neighbors, o;
for (i = 0; i < n; ++i) {
(o = nodes[i]).index = i;
o.weight = 0;
}
for (i = 0; i < m; ++i) {
o = links[i];
if (typeof o.source == 'number')
o.source = nodes[o.source];
if (typeof o.target == 'number')
o.target = nodes[o.target];
++o.source.weight;
++o.target.weight;
}
for (i = 0; i < n; ++i) {
o = nodes[i];
if (isNaN(o.x))
o.x = position('x', w);
if (isNaN(o.y))
o.y = position('y', h);
if (isNaN(o.px))
o.px = o.x;
if (isNaN(o.py))
o.py = o.y;
}
distances = [];
if (typeof linkDistance === 'function')
for (i = 0; i < m; ++i)
distances[i] = +linkDistance.call(this, links[i], i);
else
for (i = 0; i < m; ++i)
distances[i] = linkDistance;
strengths = [];
if (typeof linkStrength === 'function')
for (i = 0; i < m; ++i)
strengths[i] = +linkStrength.call(this, links[i], i);
else
for (i = 0; i < m; ++i)
strengths[i] = linkStrength;
charges = [];
if (typeof charge === 'function')
for (i = 0; i < n; ++i)
charges[i] = +charge.call(this, nodes[i], i);
else
for (i = 0; i < n; ++i)
charges[i] = charge;
function position(dimension, size) {
if (!neighbors) {
neighbors = new Array(n);
for (j = 0; j < n; ++j) {
neighbors[j] = [];
}
for (j = 0; j < m; ++j) {
var o = links[j];
neighbors[o.source.index].push(o.target);
neighbors[o.target.index].push(o.source);
}
}
var candidates = neighbors[i], j = -1, l = candidates.length, x;
while (++j < l)
if (!isNaN(x = candidates[j][dimension]))
return x;
return Math.random() * size;
}
return force.resume();
};
force.resume = function () {
return force.alpha(0.1);
};
force.stop = function () {
return force.alpha(0);
};
force.drag = function () {
if (!drag)
drag = d3.behavior.drag().origin(d3_identity).on('dragstart.force', d3_layout_forceDragstart).on('drag.force', dragmove).on('dragend.force', d3_layout_forceDragend);
if (!arguments.length)
return drag;
this.on('mouseover.force', d3_layout_forceMouseover).on('mouseout.force', d3_layout_forceMouseout).call(drag);
};
function dragmove(d) {
d.px = d3.event.x, d.py = d3.event.y;
force.resume();
}
return d3.rebind(force, event, 'on');
};
function d3_layout_forceDragstart(d) {
d.fixed |= 2;
}
function d3_layout_forceDragend(d) {
d.fixed &= ~6;
}
function d3_layout_forceMouseover(d) {
d.fixed |= 4;
d.px = d.x, d.py = d.y;
}
function d3_layout_forceMouseout(d) {
d.fixed &= ~4;
}
function d3_layout_forceAccumulate(quad, alpha, charges) {
var cx = 0, cy = 0;
quad.charge = 0;
if (!quad.leaf) {
var nodes = quad.nodes, n = nodes.length, i = -1, c;
while (++i < n) {
c = nodes[i];
if (c == null)
continue;
d3_layout_forceAccumulate(c, alpha, charges);
quad.charge += c.charge;
cx += c.charge * c.cx;
cy += c.charge * c.cy;
}
}
if (quad.point) {
if (!quad.leaf) {
quad.point.x += Math.random() - 0.5;
quad.point.y += Math.random() - 0.5;
}
var k = alpha * charges[quad.point.index];
quad.charge += quad.pointCharge = k;
cx += k * quad.point.x;
cy += k * quad.point.y;
}
quad.cx = cx / quad.charge;
quad.cy = cy / quad.charge;
}
var d3_layout_forceLinkDistance = 20, d3_layout_forceLinkStrength = 1, d3_layout_forceChargeDistance2 = Infinity;
d3.layout.hierarchy = function () {
var sort = d3_layout_hierarchySort, children = d3_layout_hierarchyChildren, value = d3_layout_hierarchyValue;
function hierarchy(root) {
var stack = [root], nodes = [], node;
root.depth = 0;
while ((node = stack.pop()) != null) {
nodes.push(node);
if ((childs = children.call(hierarchy, node, node.depth)) && (n = childs.length)) {
var n, childs, child;
while (--n >= 0) {
stack.push(child = childs[n]);
child.parent = node;
child.depth = node.depth + 1;
}
if (value)
node.value = 0;
node.children = childs;
} else {
if (value)
node.value = +value.call(hierarchy, node, node.depth) || 0;
delete node.children;
}
}
d3_layout_hierarchyVisitAfter(root, function (node) {
var childs, parent;
if (sort && (childs = node.children))
childs.sort(sort);
if (value && (parent = node.parent))
parent.value += node.value;
});
return nodes;
}
hierarchy.sort = function (x) {
if (!arguments.length)
return sort;
sort = x;
return hierarchy;
};
hierarchy.children = function (x) {
if (!arguments.length)
return children;
children = x;
return hierarchy;
};
hierarchy.value = function (x) {
if (!arguments.length)
return value;
value = x;
return hierarchy;
};
hierarchy.revalue = function (root) {
if (value) {
d3_layout_hierarchyVisitBefore(root, function (node) {
if (node.children)
node.value = 0;
});
d3_layout_hierarchyVisitAfter(root, function (node) {
var parent;
if (!node.children)
node.value = +value.call(hierarchy, node, node.depth) || 0;
if (parent = node.parent)
parent.value += node.value;
});
}
return root;
};
return hierarchy;
};
function d3_layout_hierarchyRebind(object, hierarchy) {
d3.rebind(object, hierarchy, 'sort', 'children', 'value');
object.nodes = object;
object.links = d3_layout_hierarchyLinks;
return object;
}
function d3_layout_hierarchyVisitBefore(node, callback) {
var nodes = [node];
while ((node = nodes.pop()) != null) {
callback(node);
if ((children = node.children) && (n = children.length)) {
var n, children;
while (--n >= 0)
nodes.push(children[n]);
}
}
}
function d3_layout_hierarchyVisitAfter(node, callback) {
var nodes = [node], nodes2 = [];
while ((node = nodes.pop()) != null) {
nodes2.push(node);
if ((children = node.children) && (n = children.length)) {
var i = -1, n, children;
while (++i < n)
nodes.push(children[i]);
}
}
while ((node = nodes2.pop()) != null) {
callback(node);
}
}
function d3_layout_hierarchyChildren(d) {
return d.children;
}
function d3_layout_hierarchyValue(d) {
return d.value;
}
function d3_layout_hierarchySort(a, b) {
return b.value - a.value;
}
function d3_layout_hierarchyLinks(nodes) {
return d3.merge(nodes.map(function (parent) {
return (parent.children || []).map(function (child) {
return {
source: parent,
target: child
};
});
}));
}
d3.layout.partition = function () {
var hierarchy = d3.layout.hierarchy(), size = [
1,
1
];
function position(node, x, dx, dy) {
var children = node.children;
node.x = x;
node.y = node.depth * dy;
node.dx = dx;
node.dy = dy;
if (children && (n = children.length)) {
var i = -1, n, c, d;
dx = node.value ? dx / node.value : 0;
while (++i < n) {
position(c = children[i], x, d = c.value * dx, dy);
x += d;
}
}
}
function depth(node) {
var children = node.children, d = 0;
if (children && (n = children.length)) {
var i = -1, n;
while (++i < n)
d = Math.max(d, depth(children[i]));
}
return 1 + d;
}
function partition(d, i) {
var nodes = hierarchy.call(this, d, i);
position(nodes[0], 0, size[0], size[1] / depth(nodes[0]));
return nodes;
}
partition.size = function (x) {
if (!arguments.length)
return size;
size = x;
return partition;
};
return d3_layout_hierarchyRebind(partition, hierarchy);
};
d3.layout.pie = function () {
var value = Number, sort = d3_layout_pieSortByValue, startAngle = 0, endAngle = τ, padAngle = 0;
function pie(data) {
var n = data.length, values = data.map(function (d, i) {
return +value.call(pie, d, i);
}), a = +(typeof startAngle === 'function' ? startAngle.apply(this, arguments) : startAngle), da = (typeof endAngle === 'function' ? endAngle.apply(this, arguments) : endAngle) - a, p = Math.min(Math.abs(da) / n, +(typeof padAngle === 'function' ? padAngle.apply(this, arguments) : padAngle)), pa = p * (da < 0 ? -1 : 1), sum = d3.sum(values), k = sum ? (da - n * pa) / sum : 0, index = d3.range(n), arcs = [], v;
if (sort != null)
index.sort(sort === d3_layout_pieSortByValue ? function (i, j) {
return values[j] - values[i];
} : function (i, j) {
return sort(data[i], data[j]);
});
index.forEach(function (i) {
arcs[i] = {
data: data[i],
value: v = values[i],
startAngle: a,
endAngle: a += v * k + pa,
padAngle: p
};
});
return arcs;
}
pie.value = function (_) {
if (!arguments.length)
return value;
value = _;
return pie;
};
pie.sort = function (_) {
if (!arguments.length)
return sort;
sort = _;
return pie;
};
pie.startAngle = function (_) {
if (!arguments.length)
return startAngle;
startAngle = _;
return pie;
};
pie.endAngle = function (_) {
if (!arguments.length)
return endAngle;
endAngle = _;
return pie;
};
pie.padAngle = function (_) {
if (!arguments.length)
return padAngle;
padAngle = _;
return pie;
};
return pie;
};
var d3_layout_pieSortByValue = {};
d3.layout.stack = function () {
var values = d3_identity, order = d3_layout_stackOrderDefault, offset = d3_layout_stackOffsetZero, out = d3_layout_stackOut, x = d3_layout_stackX, y = d3_layout_stackY;
function stack(data, index) {
if (!(n = data.length))
return data;
var series = data.map(function (d, i) {
return values.call(stack, d, i);
});
var points = series.map(function (d) {
return d.map(function (v, i) {
return [
x.call(stack, v, i),
y.call(stack, v, i)
];
});
});
var orders = order.call(stack, points, index);
series = d3.permute(series, orders);
points = d3.permute(points, orders);
var offsets = offset.call(stack, points, index);
var m = series[0].length, n, i, j, o;
for (j = 0; j < m; ++j) {
out.call(stack, series[0][j], o = offsets[j], points[0][j][1]);
for (i = 1; i < n; ++i) {
out.call(stack, series[i][j], o += points[i - 1][j][1], points[i][j][1]);
}
}
return data;
}
stack.values = function (x) {
if (!arguments.length)
return values;
values = x;
return stack;
};
stack.order = function (x) {
if (!arguments.length)
return order;
order = typeof x === 'function' ? x : d3_layout_stackOrders.get(x) || d3_layout_stackOrderDefault;
return stack;
};
stack.offset = function (x) {
if (!arguments.length)
return offset;
offset = typeof x === 'function' ? x : d3_layout_stackOffsets.get(x) || d3_layout_stackOffsetZero;
return stack;
};
stack.x = function (z) {
if (!arguments.length)
return x;
x = z;
return stack;
};
stack.y = function (z) {
if (!arguments.length)
return y;
y = z;
return stack;
};
stack.out = function (z) {
if (!arguments.length)
return out;
out = z;
return stack;
};
return stack;
};
function d3_layout_stackX(d) {
return d.x;
}
function d3_layout_stackY(d) {
return d.y;
}
function d3_layout_stackOut(d, y0, y) {
d.y0 = y0;
d.y = y;
}
var d3_layout_stackOrders = d3.map({
'inside-out': function (data) {
var n = data.length, i, j, max = data.map(d3_layout_stackMaxIndex), sums = data.map(d3_layout_stackReduceSum), index = d3.range(n).sort(function (a, b) {
return max[a] - max[b];
}), top = 0, bottom = 0, tops = [], bottoms = [];
for (i = 0; i < n; ++i) {
j = index[i];
if (top < bottom) {
top += sums[j];
tops.push(j);
} else {
bottom += sums[j];
bottoms.push(j);
}
}
return bottoms.reverse().concat(tops);
},
reverse: function (data) {
return d3.range(data.length).reverse();
},
'default': d3_layout_stackOrderDefault
});
var d3_layout_stackOffsets = d3.map({
silhouette: function (data) {
var n = data.length, m = data[0].length, sums = [], max = 0, i, j, o, y0 = [];
for (j = 0; j < m; ++j) {
for (i = 0, o = 0; i < n; i++)
o += data[i][j][1];
if (o > max)
max = o;
sums.push(o);
}
for (j = 0; j < m; ++j) {
y0[j] = (max - sums[j]) / 2;
}
return y0;
},
wiggle: function (data) {
var n = data.length, x = data[0], m = x.length, i, j, k, s1, s2, s3, dx, o, o0, y0 = [];
y0[0] = o = o0 = 0;
for (j = 1; j < m; ++j) {
for (i = 0, s1 = 0; i < n; ++i)
s1 += data[i][j][1];
for (i = 0, s2 = 0, dx = x[j][0] - x[j - 1][0]; i < n; ++i) {
for (k = 0, s3 = (data[i][j][1] - data[i][j - 1][1]) / (2 * dx); k < i; ++k) {
s3 += (data[k][j][1] - data[k][j - 1][1]) / dx;
}
s2 += s3 * data[i][j][1];
}
y0[j] = o -= s1 ? s2 / s1 * dx : 0;
if (o < o0)
o0 = o;
}
for (j = 0; j < m; ++j)
y0[j] -= o0;
return y0;
},
expand: function (data) {
var n = data.length, m = data[0].length, k = 1 / n, i, j, o, y0 = [];
for (j = 0; j < m; ++j) {
for (i = 0, o = 0; i < n; i++)
o += data[i][j][1];
if (o)
for (i = 0; i < n; i++)
data[i][j][1] /= o;
else
for (i = 0; i < n; i++)
data[i][j][1] = k;
}
for (j = 0; j < m; ++j)
y0[j] = 0;
return y0;
},
zero: d3_layout_stackOffsetZero
});
function d3_layout_stackOrderDefault(data) {
return d3.range(data.length);
}
function d3_layout_stackOffsetZero(data) {
var j = -1, m = data[0].length, y0 = [];
while (++j < m)
y0[j] = 0;
return y0;
}
function d3_layout_stackMaxIndex(array) {
var i = 1, j = 0, v = array[0][1], k, n = array.length;
for (; i < n; ++i) {
if ((k = array[i][1]) > v) {
j = i;
v = k;
}
}
return j;
}
function d3_layout_stackReduceSum(d) {
return d.reduce(d3_layout_stackSum, 0);
}
function d3_layout_stackSum(p, d) {
return p + d[1];
}
d3.layout.histogram = function () {
var frequency = true, valuer = Number, ranger = d3_layout_histogramRange, binner = d3_layout_histogramBinSturges;
function histogram(data, i) {
var bins = [], values = data.map(valuer, this), range = ranger.call(this, values, i), thresholds = binner.call(this, range, values, i), bin, i = -1, n = values.length, m = thresholds.length - 1, k = frequency ? 1 : 1 / n, x;
while (++i < m) {
bin = bins[i] = [];
bin.dx = thresholds[i + 1] - (bin.x = thresholds[i]);
bin.y = 0;
}
if (m > 0) {
i = -1;
while (++i < n) {
x = values[i];
if (x >= range[0] && x <= range[1]) {
bin = bins[d3.bisect(thresholds, x, 1, m) - 1];
bin.y += k;
bin.push(data[i]);
}
}
}
return bins;
}
histogram.value = function (x) {
if (!arguments.length)
return valuer;
valuer = x;
return histogram;
};
histogram.range = function (x) {
if (!arguments.length)
return ranger;
ranger = d3_functor(x);
return histogram;
};
histogram.bins = function (x) {
if (!arguments.length)
return binner;
binner = typeof x === 'number' ? function (range) {
return d3_layout_histogramBinFixed(range, x);
} : d3_functor(x);
return histogram;
};
histogram.frequency = function (x) {
if (!arguments.length)
return frequency;
frequency = !!x;
return histogram;
};
return histogram;
};
function d3_layout_histogramBinSturges(range, values) {
return d3_layout_histogramBinFixed(range, Math.ceil(Math.log(values.length) / Math.LN2 + 1));
}
function d3_layout_histogramBinFixed(range, n) {
var x = -1, b = +range[0], m = (range[1] - b) / n, f = [];
while (++x <= n)
f[x] = m * x + b;
return f;
}
function d3_layout_histogramRange(values) {
return [
d3.min(values),
d3.max(values)
];
}
d3.layout.pack = function () {
var hierarchy = d3.layout.hierarchy().sort(d3_layout_packSort), padding = 0, size = [
1,
1
], radius;
function pack(d, i) {
var nodes = hierarchy.call(this, d, i), root = nodes[0], w = size[0], h = size[1], r = radius == null ? Math.sqrt : typeof radius === 'function' ? radius : function () {
return radius;
};
root.x = root.y = 0;
d3_layout_hierarchyVisitAfter(root, function (d) {
d.r = +r(d.value);
});
d3_layout_hierarchyVisitAfter(root, d3_layout_packSiblings);
if (padding) {
var dr = padding * (radius ? 1 : Math.max(2 * root.r / w, 2 * root.r / h)) / 2;
d3_layout_hierarchyVisitAfter(root, function (d) {
d.r += dr;
});
d3_layout_hierarchyVisitAfter(root, d3_layout_packSiblings);
d3_layout_hierarchyVisitAfter(root, function (d) {
d.r -= dr;
});
}
d3_layout_packTransform(root, w / 2, h / 2, radius ? 1 : 1 / Math.max(2 * root.r / w, 2 * root.r / h));
return nodes;
}
pack.size = function (_) {
if (!arguments.length)
return size;
size = _;
return pack;
};
pack.radius = function (_) {
if (!arguments.length)
return radius;
radius = _ == null || typeof _ === 'function' ? _ : +_;
return pack;
};
pack.padding = function (_) {
if (!arguments.length)
return padding;
padding = +_;
return pack;
};
return d3_layout_hierarchyRebind(pack, hierarchy);
};
function d3_layout_packSort(a, b) {
return a.value - b.value;
}
function d3_layout_packInsert(a, b) {
var c = a._pack_next;
a._pack_next = b;
b._pack_prev = a;
b._pack_next = c;
c._pack_prev = b;
}
function d3_layout_packSplice(a, b) {
a._pack_next = b;
b._pack_prev = a;
}
function d3_layout_packIntersects(a, b) {
var dx = b.x - a.x, dy = b.y - a.y, dr = a.r + b.r;
return 0.999 * dr * dr > dx * dx + dy * dy;
}
function d3_layout_packSiblings(node) {
if (!(nodes = node.children) || !(n = nodes.length))
return;
var nodes, xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, a, b, c, i, j, k, n;
function bound(node) {
xMin = Math.min(node.x - node.r, xMin);
xMax = Math.max(node.x + node.r, xMax);
yMin = Math.min(node.y - node.r, yMin);
yMax = Math.max(node.y + node.r, yMax);
}
nodes.forEach(d3_layout_packLink);
a = nodes[0];
a.x = -a.r;
a.y = 0;
bound(a);
if (n > 1) {
b = nodes[1];
b.x = b.r;
b.y = 0;
bound(b);
if (n > 2) {
c = nodes[2];
d3_layout_packPlace(a, b, c);
bound(c);
d3_layout_packInsert(a, c);
a._pack_prev = c;
d3_layout_packInsert(c, b);
b = a._pack_next;
for (i = 3; i < n; i++) {
d3_layout_packPlace(a, b, c = nodes[i]);
var isect = 0, s1 = 1, s2 = 1;
for (j = b._pack_next; j !== b; j = j._pack_next, s1++) {
if (d3_layout_packIntersects(j, c)) {
isect = 1;
break;
}
}
if (isect == 1) {
for (k = a._pack_prev; k !== j._pack_prev; k = k._pack_prev, s2++) {
if (d3_layout_packIntersects(k, c)) {
break;
}
}
}
if (isect) {
if (s1 < s2 || s1 == s2 && b.r < a.r)
d3_layout_packSplice(a, b = j);
else
d3_layout_packSplice(a = k, b);
i--;
} else {
d3_layout_packInsert(a, c);
b = c;
bound(c);
}
}
}
}
var cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2, cr = 0;
for (i = 0; i < n; i++) {
c = nodes[i];
c.x -= cx;
c.y -= cy;
cr = Math.max(cr, c.r + Math.sqrt(c.x * c.x + c.y * c.y));
}
node.r = cr;
nodes.forEach(d3_layout_packUnlink);
}
function d3_layout_packLink(node) {
node._pack_next = node._pack_prev = node;
}
function d3_layout_packUnlink(node) {
delete node._pack_next;
delete node._pack_prev;
}
function d3_layout_packTransform(node, x, y, k) {
var children = node.children;
node.x = x += k * node.x;
node.y = y += k * node.y;
node.r *= k;
if (children) {
var i = -1, n = children.length;
while (++i < n)
d3_layout_packTransform(children[i], x, y, k);
}
}
function d3_layout_packPlace(a, b, c) {
var db = a.r + c.r, dx = b.x - a.x, dy = b.y - a.y;
if (db && (dx || dy)) {
var da = b.r + c.r, dc = dx * dx + dy * dy;
da *= da;
db *= db;
var x = 0.5 + (db - da) / (2 * dc), y = Math.sqrt(Math.max(0, 2 * da * (db + dc) - (db -= dc) * db - da * da)) / (2 * dc);
c.x = a.x + x * dx + y * dy;
c.y = a.y + x * dy - y * dx;
} else {
c.x = a.x + db;
c.y = a.y;
}
}
d3.layout.tree = function () {
var hierarchy = d3.layout.hierarchy().sort(null).value(null), separation = d3_layout_treeSeparation, size = [
1,
1
], nodeSize = null;
function tree(d, i) {
var nodes = hierarchy.call(this, d, i), root0 = nodes[0], root1 = wrapTree(root0);
d3_layout_hierarchyVisitAfter(root1, firstWalk), root1.parent.m = -root1.z;
d3_layout_hierarchyVisitBefore(root1, secondWalk);
if (nodeSize)
d3_layout_hierarchyVisitBefore(root0, sizeNode);
else {
var left = root0, right = root0, bottom = root0;
d3_layout_hierarchyVisitBefore(root0, function (node) {
if (node.x < left.x)
left = node;
if (node.x > right.x)
right = node;
if (node.depth > bottom.depth)
bottom = node;
});
var tx = separation(left, right) / 2 - left.x, kx = size[0] / (right.x + separation(right, left) / 2 + tx), ky = size[1] / (bottom.depth || 1);
d3_layout_hierarchyVisitBefore(root0, function (node) {
node.x = (node.x + tx) * kx;
node.y = node.depth * ky;
});
}
return nodes;
}
function wrapTree(root0) {
var root1 = {
A: null,
children: [root0]
}, queue = [root1], node1;
while ((node1 = queue.pop()) != null) {
for (var children = node1.children, child, i = 0, n = children.length; i < n; ++i) {
queue.push((children[i] = child = {
_: children[i],
parent: node1,
children: (child = children[i].children) && child.slice() || [],
A: null,
a: null,
z: 0,
m: 0,
c: 0,
s: 0,
t: null,
i: i
}).a = child);
}
}
return root1.children[0];
}
function firstWalk(v) {
var children = v.children, siblings = v.parent.children, w = v.i ? siblings[v.i - 1] : null;
if (children.length) {
d3_layout_treeShift(v);
var midpoint = (children[0].z + children[children.length - 1].z) / 2;
if (w) {
v.z = w.z + separation(v._, w._);
v.m = v.z - midpoint;
} else {
v.z = midpoint;
}
} else if (w) {
v.z = w.z + separation(v._, w._);
}
v.parent.A = apportion(v, w, v.parent.A || siblings[0]);
}
function secondWalk(v) {
v._.x = v.z + v.parent.m;
v.m += v.parent.m;
}
function apportion(v, w, ancestor) {
if (w) {
var vip = v, vop = v, vim = w, vom = vip.parent.children[0], sip = vip.m, sop = vop.m, sim = vim.m, som = vom.m, shift;
while (vim = d3_layout_treeRight(vim), vip = d3_layout_treeLeft(vip), vim && vip) {
vom = d3_layout_treeLeft(vom);
vop = d3_layout_treeRight(vop);
vop.a = v;
shift = vim.z + sim - vip.z - sip + separation(vim._, vip._);
if (shift > 0) {
d3_layout_treeMove(d3_layout_treeAncestor(vim, v, ancestor), v, shift);
sip += shift;
sop += shift;
}
sim += vim.m;
sip += vip.m;
som += vom.m;
sop += vop.m;
}
if (vim && !d3_layout_treeRight(vop)) {
vop.t = vim;
vop.m += sim - sop;
}
if (vip && !d3_layout_treeLeft(vom)) {
vom.t = vip;
vom.m += sip - som;
ancestor = v;
}
}
return ancestor;
}
function sizeNode(node) {
node.x *= size[0];
node.y = node.depth * size[1];
}
tree.separation = function (x) {
if (!arguments.length)
return separation;
separation = x;
return tree;
};
tree.size = function (x) {
if (!arguments.length)
return nodeSize ? null : size;
nodeSize = (size = x) == null ? sizeNode : null;
return tree;
};
tree.nodeSize = function (x) {
if (!arguments.length)
return nodeSize ? size : null;
nodeSize = (size = x) == null ? null : sizeNode;
return tree;
};
return d3_layout_hierarchyRebind(tree, hierarchy);
};
function d3_layout_treeSeparation(a, b) {
return a.parent == b.parent ? 1 : 2;
}
function d3_layout_treeLeft(v) {
var children = v.children;
return children.length ? children[0] : v.t;
}
function d3_layout_treeRight(v) {
var children = v.children, n;
return (n = children.length) ? children[n - 1] : v.t;
}
function d3_layout_treeMove(wm, wp, shift) {
var change = shift / (wp.i - wm.i);
wp.c -= change;
wp.s += shift;
wm.c += change;
wp.z += shift;
wp.m += shift;
}
function d3_layout_treeShift(v) {
var shift = 0, change = 0, children = v.children, i = children.length, w;
while (--i >= 0) {
w = children[i];
w.z += shift;
w.m += shift;
shift += w.s + (change += w.c);
}
}
function d3_layout_treeAncestor(vim, v, ancestor) {
return vim.a.parent === v.parent ? vim.a : ancestor;
}
d3.layout.cluster = function () {
var hierarchy = d3.layout.hierarchy().sort(null).value(null), separation = d3_layout_treeSeparation, size = [
1,
1
], nodeSize = false;
function cluster(d, i) {
var nodes = hierarchy.call(this, d, i), root = nodes[0], previousNode, x = 0;
d3_layout_hierarchyVisitAfter(root, function (node) {
var children = node.children;
if (children && children.length) {
node.x = d3_layout_clusterX(children);
node.y = d3_layout_clusterY(children);
} else {
node.x = previousNode ? x += separation(node, previousNode) : 0;
node.y = 0;
previousNode = node;
}
});
var left = d3_layout_clusterLeft(root), right = d3_layout_clusterRight(root), x0 = left.x - separation(left, right) / 2, x1 = right.x + separation(right, left) / 2;
d3_layout_hierarchyVisitAfter(root, nodeSize ? function (node) {
node.x = (node.x - root.x) * size[0];
node.y = (root.y - node.y) * size[1];
} : function (node) {
node.x = (node.x - x0) / (x1 - x0) * size[0];
node.y = (1 - (root.y ? node.y / root.y : 1)) * size[1];
});
return nodes;
}
cluster.separation = function (x) {
if (!arguments.length)
return separation;
separation = x;
return cluster;
};
cluster.size = function (x) {
if (!arguments.length)
return nodeSize ? null : size;
nodeSize = (size = x) == null;
return cluster;
};
cluster.nodeSize = function (x) {
if (!arguments.length)
return nodeSize ? size : null;
nodeSize = (size = x) != null;
return cluster;
};
return d3_layout_hierarchyRebind(cluster, hierarchy);
};
function d3_layout_clusterY(children) {
return 1 + d3.max(children, function (child) {
return child.y;
});
}
function d3_layout_clusterX(children) {
return children.reduce(function (x, child) {
return x + child.x;
}, 0) / children.length;
}
function d3_layout_clusterLeft(node) {
var children = node.children;
return children && children.length ? d3_layout_clusterLeft(children[0]) : node;
}
function d3_layout_clusterRight(node) {
var children = node.children, n;
return children && (n = children.length) ? d3_layout_clusterRight(children[n - 1]) : node;
}
d3.layout.treemap = function () {
var hierarchy = d3.layout.hierarchy(), round = Math.round, size = [
1,
1
], padding = null, pad = d3_layout_treemapPadNull, sticky = false, stickies, mode = 'squarify', ratio = 0.5 * (1 + Math.sqrt(5));
function scale(children, k) {
var i = -1, n = children.length, child, area;
while (++i < n) {
area = (child = children[i]).value * (k < 0 ? 0 : k);
child.area = isNaN(area) || area <= 0 ? 0 : area;
}
}
function squarify(node) {
var children = node.children;
if (children && children.length) {
var rect = pad(node), row = [], remaining = children.slice(), child, best = Infinity, score, u = mode === 'slice' ? rect.dx : mode === 'dice' ? rect.dy : mode === 'slice-dice' ? node.depth & 1 ? rect.dy : rect.dx : Math.min(rect.dx, rect.dy), n;
scale(remaining, rect.dx * rect.dy / node.value);
row.area = 0;
while ((n = remaining.length) > 0) {
row.push(child = remaining[n - 1]);
row.area += child.area;
if (mode !== 'squarify' || (score = worst(row, u)) <= best) {
remaining.pop();
best = score;
} else {
row.area -= row.pop().area;
position(row, u, rect, false);
u = Math.min(rect.dx, rect.dy);
row.length = row.area = 0;
best = Infinity;
}
}
if (row.length) {
position(row, u, rect, true);
row.length = row.area = 0;
}
children.forEach(squarify);
}
}
function stickify(node) {
var children = node.children;
if (children && children.length) {
var rect = pad(node), remaining = children.slice(), child, row = [];
scale(remaining, rect.dx * rect.dy / node.value);
row.area = 0;
while (child = remaining.pop()) {
row.push(child);
row.area += child.area;
if (child.z != null) {
position(row, child.z ? rect.dx : rect.dy, rect, !remaining.length);
row.length = row.area = 0;
}
}
children.forEach(stickify);
}
}
function worst(row, u) {
var s = row.area, r, rmax = 0, rmin = Infinity, i = -1, n = row.length;
while (++i < n) {
if (!(r = row[i].area))
continue;
if (r < rmin)
rmin = r;
if (r > rmax)
rmax = r;
}
s *= s;
u *= u;
return s ? Math.max(u * rmax * ratio / s, s / (u * rmin * ratio)) : Infinity;
}
function position(row, u, rect, flush) {
var i = -1, n = row.length, x = rect.x, y = rect.y, v = u ? round(row.area / u) : 0, o;
if (u == rect.dx) {
if (flush || v > rect.dy)
v = rect.dy;
while (++i < n) {
o = row[i];
o.x = x;
o.y = y;
o.dy = v;
x += o.dx = Math.min(rect.x + rect.dx - x, v ? round(o.area / v) : 0);
}
o.z = true;
o.dx += rect.x + rect.dx - x;
rect.y += v;
rect.dy -= v;
} else {
if (flush || v > rect.dx)
v = rect.dx;
while (++i < n) {
o = row[i];
o.x = x;
o.y = y;
o.dx = v;
y += o.dy = Math.min(rect.y + rect.dy - y, v ? round(o.area / v) : 0);
}
o.z = false;
o.dy += rect.y + rect.dy - y;
rect.x += v;
rect.dx -= v;
}
}
function treemap(d) {
var nodes = stickies || hierarchy(d), root = nodes[0];
root.x = root.y = 0;
if (root.value)
root.dx = size[0], root.dy = size[1];
else
root.dx = root.dy = 0;
if (stickies)
hierarchy.revalue(root);
scale([root], root.dx * root.dy / root.value);
(stickies ? stickify : squarify)(root);
if (sticky)
stickies = nodes;
return nodes;
}
treemap.size = function (x) {
if (!arguments.length)
return size;
size = x;
return treemap;
};
treemap.padding = function (x) {
if (!arguments.length)
return padding;
function padFunction(node) {
var p = x.call(treemap, node, node.depth);
return p == null ? d3_layout_treemapPadNull(node) : d3_layout_treemapPad(node, typeof p === 'number' ? [
p,
p,
p,
p
] : p);
}
function padConstant(node) {
return d3_layout_treemapPad(node, x);
}
var type;
pad = (padding = x) == null ? d3_layout_treemapPadNull : (type = typeof x) === 'function' ? padFunction : type === 'number' ? (x = [
x,
x,
x,
x
], padConstant) : padConstant;
return treemap;
};
treemap.round = function (x) {
if (!arguments.length)
return round != Number;
round = x ? Math.round : Number;
return treemap;
};
treemap.sticky = function (x) {
if (!arguments.length)
return sticky;
sticky = x;
stickies = null;
return treemap;
};
treemap.ratio = function (x) {
if (!arguments.length)
return ratio;
ratio = x;
return treemap;
};
treemap.mode = function (x) {
if (!arguments.length)
return mode;
mode = x + '';
return treemap;
};
return d3_layout_hierarchyRebind(treemap, hierarchy);
};
function d3_layout_treemapPadNull(node) {
return {
x: node.x,
y: node.y,
dx: node.dx,
dy: node.dy
};
}
function d3_layout_treemapPad(node, padding) {
var x = node.x + padding[3], y = node.y + padding[0], dx = node.dx - padding[1] - padding[3], dy = node.dy - padding[0] - padding[2];
if (dx < 0) {
x += dx / 2;
dx = 0;
}
if (dy < 0) {
y += dy / 2;
dy = 0;
}
return {
x: x,
y: y,
dx: dx,
dy: dy
};
}
d3.random = {
normal: function (µ, σ) {
var n = arguments.length;
if (n < 2)
σ = 1;
if (n < 1)
µ = 0;
return function () {
var x, y, r;
do {
x = Math.random() * 2 - 1;
y = Math.random() * 2 - 1;
r = x * x + y * y;
} while (!r || r > 1);
return µ + σ * x * Math.sqrt(-2 * Math.log(r) / r);
};
},
logNormal: function () {
var random = d3.random.normal.apply(d3, arguments);
return function () {
return Math.exp(random());
};
},
bates: function (m) {
var random = d3.random.irwinHall(m);
return function () {
return random() / m;
};
},
irwinHall: function (m) {
return function () {
for (var s = 0, j = 0; j < m; j++)
s += Math.random();
return s;
};
}
};
d3.scale = {};
function d3_scaleExtent(domain) {
var start = domain[0], stop = domain[domain.length - 1];
return start < stop ? [
start,
stop
] : [
stop,
start
];
}
function d3_scaleRange(scale) {
return scale.rangeExtent ? scale.rangeExtent() : d3_scaleExtent(scale.range());
}
function d3_scale_bilinear(domain, range, uninterpolate, interpolate) {
var u = uninterpolate(domain[0], domain[1]), i = interpolate(range[0], range[1]);
return function (x) {
return i(u(x));
};
}
function d3_scale_nice(domain, nice) {
var i0 = 0, i1 = domain.length - 1, x0 = domain[i0], x1 = domain[i1], dx;
if (x1 < x0) {
dx = i0, i0 = i1, i1 = dx;
dx = x0, x0 = x1, x1 = dx;
}
domain[i0] = nice.floor(x0);
domain[i1] = nice.ceil(x1);
return domain;
}
function d3_scale_niceStep(step) {
return step ? {
floor: function (x) {
return Math.floor(x / step) * step;
},
ceil: function (x) {
return Math.ceil(x / step) * step;
}
} : d3_scale_niceIdentity;
}
var d3_scale_niceIdentity = {
floor: d3_identity,
ceil: d3_identity
};
function d3_scale_polylinear(domain, range, uninterpolate, interpolate) {
var u = [], i = [], j = 0, k = Math.min(domain.length, range.length) - 1;
if (domain[k] < domain[0]) {
domain = domain.slice().reverse();
range = range.slice().reverse();
}
while (++j <= k) {
u.push(uninterpolate(domain[j - 1], domain[j]));
i.push(interpolate(range[j - 1], range[j]));
}
return function (x) {
var j = d3.bisect(domain, x, 1, k) - 1;
return i[j](u[j](x));
};
}
d3.scale.linear = function () {
return d3_scale_linear([
0,
1
], [
0,
1
], d3_interpolate, false);
};
function d3_scale_linear(domain, range, interpolate, clamp) {
var output, input;
function rescale() {
var linear = Math.min(domain.length, range.length) > 2 ? d3_scale_polylinear : d3_scale_bilinear, uninterpolate = clamp ? d3_uninterpolateClamp : d3_uninterpolateNumber;
output = linear(domain, range, uninterpolate, interpolate);
input = linear(range, domain, uninterpolate, d3_interpolate);
return scale;
}
function scale(x) {
return output(x);
}
scale.invert = function (y) {
return input(y);
};
scale.domain = function (x) {
if (!arguments.length)
return domain;
domain = x.map(Number);
return rescale();
};
scale.range = function (x) {
if (!arguments.length)
return range;
range = x;
return rescale();
};
scale.rangeRound = function (x) {
return scale.range(x).interpolate(d3_interpolateRound);
};
scale.clamp = function (x) {
if (!arguments.length)
return clamp;
clamp = x;
return rescale();
};
scale.interpolate = function (x) {
if (!arguments.length)
return interpolate;
interpolate = x;
return rescale();
};
scale.ticks = function (m) {
return d3_scale_linearTicks(domain, m);
};
scale.tickFormat = function (m, format) {
return d3_scale_linearTickFormat(domain, m, format);
};
scale.nice = function (m) {
d3_scale_linearNice(domain, m);
return rescale();
};
scale.copy = function () {
return d3_scale_linear(domain, range, interpolate, clamp);
};
return rescale();
}
function d3_scale_linearRebind(scale, linear) {
return d3.rebind(scale, linear, 'range', 'rangeRound', 'interpolate', 'clamp');
}
function d3_scale_linearNice(domain, m) {
d3_scale_nice(domain, d3_scale_niceStep(d3_scale_linearTickRange(domain, m)[2]));
d3_scale_nice(domain, d3_scale_niceStep(d3_scale_linearTickRange(domain, m)[2]));
return domain;
}
function d3_scale_linearTickRange(domain, m) {
if (m == null)
m = 10;
var extent = d3_scaleExtent(domain), span = extent[1] - extent[0], step = Math.pow(10, Math.floor(Math.log(span / m) / Math.LN10)), err = m / span * step;
if (err <= 0.15)
step *= 10;
else if (err <= 0.35)
step *= 5;
else if (err <= 0.75)
step *= 2;
extent[0] = Math.ceil(extent[0] / step) * step;
extent[1] = Math.floor(extent[1] / step) * step + step * 0.5;
extent[2] = step;
return extent;
}
function d3_scale_linearTicks(domain, m) {
return d3.range.apply(d3, d3_scale_linearTickRange(domain, m));
}
function d3_scale_linearTickFormat(domain, m, format) {
var range = d3_scale_linearTickRange(domain, m);
if (format) {
var match = d3_format_re.exec(format);
match.shift();
if (match[8] === 's') {
var prefix = d3.formatPrefix(Math.max(abs(range[0]), abs(range[1])));
if (!match[7])
match[7] = '.' + d3_scale_linearPrecision(prefix.scale(range[2]));
match[8] = 'f';
format = d3.format(match.join(''));
return function (d) {
return format(prefix.scale(d)) + prefix.symbol;
};
}
if (!match[7])
match[7] = '.' + d3_scale_linearFormatPrecision(match[8], range);
format = match.join('');
} else {
format = ',.' + d3_scale_linearPrecision(range[2]) + 'f';
}
return d3.format(format);
}
var d3_scale_linearFormatSignificant = {
s: 1,
g: 1,
p: 1,
r: 1,
e: 1
};
function d3_scale_linearPrecision(value) {
return -Math.floor(Math.log(value) / Math.LN10 + 0.01);
}
function d3_scale_linearFormatPrecision(type, range) {
var p = d3_scale_linearPrecision(range[2]);
return type in d3_scale_linearFormatSignificant ? Math.abs(p - d3_scale_linearPrecision(Math.max(abs(range[0]), abs(range[1])))) + +(type !== 'e') : p - (type === '%') * 2;
}
d3.scale.log = function () {
return d3_scale_log(d3.scale.linear().domain([
0,
1
]), 10, true, [
1,
10
]);
};
function d3_scale_log(linear, base, positive, domain) {
function log(x) {
return (positive ? Math.log(x < 0 ? 0 : x) : -Math.log(x > 0 ? 0 : -x)) / Math.log(base);
}
function pow(x) {
return positive ? Math.pow(base, x) : -Math.pow(base, -x);
}
function scale(x) {
return linear(log(x));
}
scale.invert = function (x) {
return pow(linear.invert(x));
};
scale.domain = function (x) {
if (!arguments.length)
return domain;
positive = x[0] >= 0;
linear.domain((domain = x.map(Number)).map(log));
return scale;
};
scale.base = function (_) {
if (!arguments.length)
return base;
base = +_;
linear.domain(domain.map(log));
return scale;
};
scale.nice = function () {
var niced = d3_scale_nice(domain.map(log), positive ? Math : d3_scale_logNiceNegative);
linear.domain(niced);
domain = niced.map(pow);
return scale;
};
scale.ticks = function () {
var extent = d3_scaleExtent(domain), ticks = [], u = extent[0], v = extent[1], i = Math.floor(log(u)), j = Math.ceil(log(v)), n = base % 1 ? 2 : base;
if (isFinite(j - i)) {
if (positive) {
for (; i < j; i++)
for (var k = 1; k < n; k++)
ticks.push(pow(i) * k);
ticks.push(pow(i));
} else {
ticks.push(pow(i));
for (; i++ < j;)
for (var k = n - 1; k > 0; k--)
ticks.push(pow(i) * k);
}
for (i = 0; ticks[i] < u; i++) {
}
for (j = ticks.length; ticks[j - 1] > v; j--) {
}
ticks = ticks.slice(i, j);
}
return ticks;
};
scale.tickFormat = function (n, format) {
if (!arguments.length)
return d3_scale_logFormat;
if (arguments.length < 2)
format = d3_scale_logFormat;
else if (typeof format !== 'function')
format = d3.format(format);
var k = Math.max(1, base * n / scale.ticks().length);
return function (d) {
var i = d / pow(Math.round(log(d)));
if (i * base < base - 0.5)
i *= base;
return i <= k ? format(d) : '';
};
};
scale.copy = function () {
return d3_scale_log(linear.copy(), base, positive, domain);
};
return d3_scale_linearRebind(scale, linear);
}
var d3_scale_logFormat = d3.format('.0e'), d3_scale_logNiceNegative = {
floor: function (x) {
return -Math.ceil(-x);
},
ceil: function (x) {
return -Math.floor(-x);
}
};
d3.scale.pow = function () {
return d3_scale_pow(d3.scale.linear(), 1, [
0,
1
]);
};
function d3_scale_pow(linear, exponent, domain) {
var powp = d3_scale_powPow(exponent), powb = d3_scale_powPow(1 / exponent);
function scale(x) {
return linear(powp(x));
}
scale.invert = function (x) {
return powb(linear.invert(x));
};
scale.domain = function (x) {
if (!arguments.length)
return domain;
linear.domain((domain = x.map(Number)).map(powp));
return scale;
};
scale.ticks = function (m) {
return d3_scale_linearTicks(domain, m);
};
scale.tickFormat = function (m, format) {
return d3_scale_linearTickFormat(domain, m, format);
};
scale.nice = function (m) {
return scale.domain(d3_scale_linearNice(domain, m));
};
scale.exponent = function (x) {
if (!arguments.length)
return exponent;
powp = d3_scale_powPow(exponent = x);
powb = d3_scale_powPow(1 / exponent);
linear.domain(domain.map(powp));
return scale;
};
scale.copy = function () {
return d3_scale_pow(linear.copy(), exponent, domain);
};
return d3_scale_linearRebind(scale, linear);
}
function d3_scale_powPow(e) {
return function (x) {
return x < 0 ? -Math.pow(-x, e) : Math.pow(x, e);
};
}
d3.scale.sqrt = function () {
return d3.scale.pow().exponent(0.5);
};
d3.scale.ordinal = function () {
return d3_scale_ordinal([], {
t: 'range',
a: [[]]
});
};
function d3_scale_ordinal(domain, ranger) {
var index, range, rangeBand;
function scale(x) {
return range[((index.get(x) || (ranger.t === 'range' ? index.set(x, domain.push(x)) : NaN)) - 1) % range.length];
}
function steps(start, step) {
return d3.range(domain.length).map(function (i) {
return start + step * i;
});
}
scale.domain = function (x) {
if (!arguments.length)
return domain;
domain = [];
index = new d3_Map();
var i = -1, n = x.length, xi;
while (++i < n)
if (!index.has(xi = x[i]))
index.set(xi, domain.push(xi));
return scale[ranger.t].apply(scale, ranger.a);
};
scale.range = function (x) {
if (!arguments.length)
return range;
range = x;
rangeBand = 0;
ranger = {
t: 'range',
a: arguments
};
return scale;
};
scale.rangePoints = function (x, padding) {
if (arguments.length < 2)
padding = 0;
var start = x[0], stop = x[1], step = domain.length < 2 ? (start = (start + stop) / 2, 0) : (stop - start) / (domain.length - 1 + padding);
range = steps(start + step * padding / 2, step);
rangeBand = 0;
ranger = {
t: 'rangePoints',
a: arguments
};
return scale;
};
scale.rangeRoundPoints = function (x, padding) {
if (arguments.length < 2)
padding = 0;
var start = x[0], stop = x[1], step = domain.length < 2 ? (start = stop = Math.round((start + stop) / 2), 0) : (stop - start) / (domain.length - 1 + padding) | 0;
range = steps(start + Math.round(step * padding / 2 + (stop - start - (domain.length - 1 + padding) * step) / 2), step);
rangeBand = 0;
ranger = {
t: 'rangeRoundPoints',
a: arguments
};
return scale;
};
scale.rangeBands = function (x, padding, outerPadding) {
if (arguments.length < 2)
padding = 0;
if (arguments.length < 3)
outerPadding = padding;
var reverse = x[1] < x[0], start = x[reverse - 0], stop = x[1 - reverse], step = (stop - start) / (domain.length - padding + 2 * outerPadding);
range = steps(start + step * outerPadding, step);
if (reverse)
range.reverse();
rangeBand = step * (1 - padding);
ranger = {
t: 'rangeBands',
a: arguments
};
return scale;
};
scale.rangeRoundBands = function (x, padding, outerPadding) {
if (arguments.length < 2)
padding = 0;
if (arguments.length < 3)
outerPadding = padding;
var reverse = x[1] < x[0], start = x[reverse - 0], stop = x[1 - reverse], step = Math.floor((stop - start) / (domain.length - padding + 2 * outerPadding));
range = steps(start + Math.round((stop - start - (domain.length - padding) * step) / 2), step);
if (reverse)
range.reverse();
rangeBand = Math.round(step * (1 - padding));
ranger = {
t: 'rangeRoundBands',
a: arguments
};
return scale;
};
scale.rangeBand = function () {
return rangeBand;
};
scale.rangeExtent = function () {
return d3_scaleExtent(ranger.a[0]);
};
scale.copy = function () {
return d3_scale_ordinal(domain, ranger);
};
return scale.domain(domain);
}
d3.scale.category10 = function () {
return d3.scale.ordinal().range(d3_category10);
};
d3.scale.category20 = function () {
return d3.scale.ordinal().range(d3_category20);
};
d3.scale.category20b = function () {
return d3.scale.ordinal().range(d3_category20b);
};
d3.scale.category20c = function () {
return d3.scale.ordinal().range(d3_category20c);
};
var d3_category10 = [
2062260,
16744206,
2924588,
14034728,
9725885,
9197131,
14907330,
8355711,
12369186,
1556175
].map(d3_rgbString);
var d3_category20 = [
2062260,
11454440,
16744206,
16759672,
2924588,
10018698,
14034728,
16750742,
9725885,
12955861,
9197131,
12885140,
14907330,
16234194,
8355711,
13092807,
12369186,
14408589,
1556175,
10410725
].map(d3_rgbString);
var d3_category20b = [
3750777,
5395619,
7040719,
10264286,
6519097,
9216594,
11915115,
13556636,
9202993,
12426809,
15186514,
15190932,
8666169,
11356490,
14049643,
15177372,
8077683,
10834324,
13528509,
14589654
].map(d3_rgbString);
var d3_category20c = [
3244733,
7057110,
10406625,
13032431,
15095053,
16616764,
16625259,
16634018,
3253076,
7652470,
10607003,
13101504,
7695281,
10394312,
12369372,
14342891,
6513507,
9868950,
12434877,
14277081
].map(d3_rgbString);
d3.scale.quantile = function () {
return d3_scale_quantile([], []);
};
function d3_scale_quantile(domain, range) {
var thresholds;
function rescale() {
var k = 0, q = range.length;
thresholds = [];
while (++k < q)
thresholds[k - 1] = d3.quantile(domain, k / q);
return scale;
}
function scale(x) {
if (!isNaN(x = +x))
return range[d3.bisect(thresholds, x)];
}
scale.domain = function (x) {
if (!arguments.length)
return domain;
domain = x.map(d3_number).filter(d3_numeric).sort(d3_ascending);
return rescale();
};
scale.range = function (x) {
if (!arguments.length)
return range;
range = x;
return rescale();
};
scale.quantiles = function () {
return thresholds;
};
scale.invertExtent = function (y) {
y = range.indexOf(y);
return y < 0 ? [
NaN,
NaN
] : [
y > 0 ? thresholds[y - 1] : domain[0],
y < thresholds.length ? thresholds[y] : domain[domain.length - 1]
];
};
scale.copy = function () {
return d3_scale_quantile(domain, range);
};
return rescale();
}
d3.scale.quantize = function () {
return d3_scale_quantize(0, 1, [
0,
1
]);
};
function d3_scale_quantize(x0, x1, range) {
var kx, i;
function scale(x) {
return range[Math.max(0, Math.min(i, Math.floor(kx * (x - x0))))];
}
function rescale() {
kx = range.length / (x1 - x0);
i = range.length - 1;
return scale;
}
scale.domain = function (x) {
if (!arguments.length)
return [
x0,
x1
];
x0 = +x[0];
x1 = +x[x.length - 1];
return rescale();
};
scale.range = function (x) {
if (!arguments.length)
return range;
range = x;
return rescale();
};
scale.invertExtent = function (y) {
y = range.indexOf(y);
y = y < 0 ? NaN : y / kx + x0;
return [
y,
y + 1 / kx
];
};
scale.copy = function () {
return d3_scale_quantize(x0, x1, range);
};
return rescale();
}
d3.scale.threshold = function () {
return d3_scale_threshold([0.5], [
0,
1
]);
};
function d3_scale_threshold(domain, range) {
function scale(x) {
if (x <= x)
return range[d3.bisect(domain, x)];
}
scale.domain = function (_) {
if (!arguments.length)
return domain;
domain = _;
return scale;
};
scale.range = function (_) {
if (!arguments.length)
return range;
range = _;
return scale;
};
scale.invertExtent = function (y) {
y = range.indexOf(y);
return [
domain[y - 1],
domain[y]
];
};
scale.copy = function () {
return d3_scale_threshold(domain, range);
};
return scale;
}
d3.scale.identity = function () {
return d3_scale_identity([
0,
1
]);
};
function d3_scale_identity(domain) {
function identity(x) {
return +x;
}
identity.invert = identity;
identity.domain = identity.range = function (x) {
if (!arguments.length)
return domain;
domain = x.map(identity);
return identity;
};
identity.ticks = function (m) {
return d3_scale_linearTicks(domain, m);
};
identity.tickFormat = function (m, format) {
return d3_scale_linearTickFormat(domain, m, format);
};
identity.copy = function () {
return d3_scale_identity(domain);
};
return identity;
}
d3.svg = {};
function d3_zero() {
return 0;
}
d3.svg.arc = function () {
var innerRadius = d3_svg_arcInnerRadius, outerRadius = d3_svg_arcOuterRadius, cornerRadius = d3_zero, padRadius = d3_svg_arcAuto, startAngle = d3_svg_arcStartAngle, endAngle = d3_svg_arcEndAngle, padAngle = d3_svg_arcPadAngle;
function arc() {
var r0 = Math.max(0, +innerRadius.apply(this, arguments)), r1 = Math.max(0, +outerRadius.apply(this, arguments)), a0 = startAngle.apply(this, arguments) - halfπ, a1 = endAngle.apply(this, arguments) - halfπ, da = Math.abs(a1 - a0), cw = a0 > a1 ? 0 : 1;
if (r1 < r0)
rc = r1, r1 = r0, r0 = rc;
if (da >= τε)
return circleSegment(r1, cw) + (r0 ? circleSegment(r0, 1 - cw) : '') + 'Z';
var rc, cr, rp, ap, p0 = 0, p1 = 0, x0, y0, x1, y1, x2, y2, x3, y3, path = [];
if (ap = (+padAngle.apply(this, arguments) || 0) / 2) {
rp = padRadius === d3_svg_arcAuto ? Math.sqrt(r0 * r0 + r1 * r1) : +padRadius.apply(this, arguments);
if (!cw)
p1 *= -1;
if (r1)
p1 = d3_asin(rp / r1 * Math.sin(ap));
if (r0)
p0 = d3_asin(rp / r0 * Math.sin(ap));
}
if (r1) {
x0 = r1 * Math.cos(a0 + p1);
y0 = r1 * Math.sin(a0 + p1);
x1 = r1 * Math.cos(a1 - p1);
y1 = r1 * Math.sin(a1 - p1);
var l1 = Math.abs(a1 - a0 - 2 * p1) <= π ? 0 : 1;
if (p1 && d3_svg_arcSweep(x0, y0, x1, y1) === cw ^ l1) {
var h1 = (a0 + a1) / 2;
x0 = r1 * Math.cos(h1);
y0 = r1 * Math.sin(h1);
x1 = y1 = null;
}
} else {
x0 = y0 = 0;
}
if (r0) {
x2 = r0 * Math.cos(a1 - p0);
y2 = r0 * Math.sin(a1 - p0);
x3 = r0 * Math.cos(a0 + p0);
y3 = r0 * Math.sin(a0 + p0);
var l0 = Math.abs(a0 - a1 + 2 * p0) <= π ? 0 : 1;
if (p0 && d3_svg_arcSweep(x2, y2, x3, y3) === 1 - cw ^ l0) {
var h0 = (a0 + a1) / 2;
x2 = r0 * Math.cos(h0);
y2 = r0 * Math.sin(h0);
x3 = y3 = null;
}
} else {
x2 = y2 = 0;
}
if (da > ε && (rc = Math.min(Math.abs(r1 - r0) / 2, +cornerRadius.apply(this, arguments))) > 0.001) {
cr = r0 < r1 ^ cw ? 0 : 1;
var rc1 = rc, rc0 = rc;
if (da < π) {
var oc = x3 == null ? [
x2,
y2
] : x1 == null ? [
x0,
y0
] : d3_geom_polygonIntersect([
x0,
y0
], [
x3,
y3
], [
x1,
y1
], [
x2,
y2
]), ax = x0 - oc[0], ay = y0 - oc[1], bx = x1 - oc[0], by = y1 - oc[1], kc = 1 / Math.sin(Math.acos((ax * bx + ay * by) / (Math.sqrt(ax * ax + ay * ay) * Math.sqrt(bx * bx + by * by))) / 2), lc = Math.sqrt(oc[0] * oc[0] + oc[1] * oc[1]);
rc0 = Math.min(rc, (r0 - lc) / (kc - 1));
rc1 = Math.min(rc, (r1 - lc) / (kc + 1));
}
if (x1 != null) {
var t30 = d3_svg_arcCornerTangents(x3 == null ? [
x2,
y2
] : [
x3,
y3
], [
x0,
y0
], r1, rc1, cw), t12 = d3_svg_arcCornerTangents([
x1,
y1
], [
x2,
y2
], r1, rc1, cw);
if (rc === rc1) {
path.push('M', t30[0], 'A', rc1, ',', rc1, ' 0 0,', cr, ' ', t30[1], 'A', r1, ',', r1, ' 0 ', 1 - cw ^ d3_svg_arcSweep(t30[1][0], t30[1][1], t12[1][0], t12[1][1]), ',', cw, ' ', t12[1], 'A', rc1, ',', rc1, ' 0 0,', cr, ' ', t12[0]);
} else {
path.push('M', t30[0], 'A', rc1, ',', rc1, ' 0 1,', cr, ' ', t12[0]);
}
} else {
path.push('M', x0, ',', y0);
}
if (x3 != null) {
var t03 = d3_svg_arcCornerTangents([
x0,
y0
], [
x3,
y3
], r0, -rc0, cw), t21 = d3_svg_arcCornerTangents([
x2,
y2
], x1 == null ? [
x0,
y0
] : [
x1,
y1
], r0, -rc0, cw);
if (rc === rc0) {
path.push('L', t21[0], 'A', rc0, ',', rc0, ' 0 0,', cr, ' ', t21[1], 'A', r0, ',', r0, ' 0 ', cw ^ d3_svg_arcSweep(t21[1][0], t21[1][1], t03[1][0], t03[1][1]), ',', 1 - cw, ' ', t03[1], 'A', rc0, ',', rc0, ' 0 0,', cr, ' ', t03[0]);
} else {
path.push('L', t21[0], 'A', rc0, ',', rc0, ' 0 0,', cr, ' ', t03[0]);
}
} else {
path.push('L', x2, ',', y2);
}
} else {
path.push('M', x0, ',', y0);
if (x1 != null)
path.push('A', r1, ',', r1, ' 0 ', l1, ',', cw, ' ', x1, ',', y1);
path.push('L', x2, ',', y2);
if (x3 != null)
path.push('A', r0, ',', r0, ' 0 ', l0, ',', 1 - cw, ' ', x3, ',', y3);
}
path.push('Z');
return path.join('');
}
function circleSegment(r1, cw) {
return 'M0,' + r1 + 'A' + r1 + ',' + r1 + ' 0 1,' + cw + ' 0,' + -r1 + 'A' + r1 + ',' + r1 + ' 0 1,' + cw + ' 0,' + r1;
}
arc.innerRadius = function (v) {
if (!arguments.length)
return innerRadius;
innerRadius = d3_functor(v);
return arc;
};
arc.outerRadius = function (v) {
if (!arguments.length)
return outerRadius;
outerRadius = d3_functor(v);
return arc;
};
arc.cornerRadius = function (v) {
if (!arguments.length)
return cornerRadius;
cornerRadius = d3_functor(v);
return arc;
};
arc.padRadius = function (v) {
if (!arguments.length)
return padRadius;
padRadius = v == d3_svg_arcAuto ? d3_svg_arcAuto : d3_functor(v);
return arc;
};
arc.startAngle = function (v) {
if (!arguments.length)
return startAngle;
startAngle = d3_functor(v);
return arc;
};
arc.endAngle = function (v) {
if (!arguments.length)
return endAngle;
endAngle = d3_functor(v);
return arc;
};
arc.padAngle = function (v) {
if (!arguments.length)
return padAngle;
padAngle = d3_functor(v);
return arc;
};
arc.centroid = function () {
var r = (+innerRadius.apply(this, arguments) + +outerRadius.apply(this, arguments)) / 2, a = (+startAngle.apply(this, arguments) + +endAngle.apply(this, arguments)) / 2 - halfπ;
return [
Math.cos(a) * r,
Math.sin(a) * r
];
};
return arc;
};
var d3_svg_arcAuto = 'auto';
function d3_svg_arcInnerRadius(d) {
return d.innerRadius;
}
function d3_svg_arcOuterRadius(d) {
return d.outerRadius;
}
function d3_svg_arcStartAngle(d) {
return d.startAngle;
}
function d3_svg_arcEndAngle(d) {
return d.endAngle;
}
function d3_svg_arcPadAngle(d) {
return d && d.padAngle;
}
function d3_svg_arcSweep(x0, y0, x1, y1) {
return (x0 - x1) * y0 - (y0 - y1) * x0 > 0 ? 0 : 1;
}
function d3_svg_arcCornerTangents(p0, p1, r1, rc, cw) {
var x01 = p0[0] - p1[0], y01 = p0[1] - p1[1], lo = (cw ? rc : -rc) / Math.sqrt(x01 * x01 + y01 * y01), ox = lo * y01, oy = -lo * x01, x1 = p0[0] + ox, y1 = p0[1] + oy, x2 = p1[0] + ox, y2 = p1[1] + oy, x3 = (x1 + x2) / 2, y3 = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, d2 = dx * dx + dy * dy, r = r1 - rc, D = x1 * y2 - x2 * y1, d = (dy < 0 ? -1 : 1) * Math.sqrt(Math.max(0, r * r * d2 - D * D)), cx0 = (D * dy - dx * d) / d2, cy0 = (-D * dx - dy * d) / d2, cx1 = (D * dy + dx * d) / d2, cy1 = (-D * dx + dy * d) / d2, dx0 = cx0 - x3, dy0 = cy0 - y3, dx1 = cx1 - x3, dy1 = cy1 - y3;
if (dx0 * dx0 + dy0 * dy0 > dx1 * dx1 + dy1 * dy1)
cx0 = cx1, cy0 = cy1;
return [
[
cx0 - ox,
cy0 - oy
],
[
cx0 * r1 / r,
cy0 * r1 / r
]
];
}
function d3_svg_line(projection) {
var x = d3_geom_pointX, y = d3_geom_pointY, defined = d3_true, interpolate = d3_svg_lineLinear, interpolateKey = interpolate.key, tension = 0.7;
function line(data) {
var segments = [], points = [], i = -1, n = data.length, d, fx = d3_functor(x), fy = d3_functor(y);
function segment() {
segments.push('M', interpolate(projection(points), tension));
}
while (++i < n) {
if (defined.call(this, d = data[i], i)) {
points.push([
+fx.call(this, d, i),
+fy.call(this, d, i)
]);
} else if (points.length) {
segment();
points = [];
}
}
if (points.length)
segment();
return segments.length ? segments.join('') : null;
}
line.x = function (_) {
if (!arguments.length)
return x;
x = _;
return line;
};
line.y = function (_) {
if (!arguments.length)
return y;
y = _;
return line;
};
line.defined = function (_) {
if (!arguments.length)
return defined;
defined = _;
return line;
};
line.interpolate = function (_) {
if (!arguments.length)
return interpolateKey;
if (typeof _ === 'function')
interpolateKey = interpolate = _;
else
interpolateKey = (interpolate = d3_svg_lineInterpolators.get(_) || d3_svg_lineLinear).key;
return line;
};
line.tension = function (_) {
if (!arguments.length)
return tension;
tension = _;
return line;
};
return line;
}
d3.svg.line = function () {
return d3_svg_line(d3_identity);
};
var d3_svg_lineInterpolators = d3.map({
linear: d3_svg_lineLinear,
'linear-closed': d3_svg_lineLinearClosed,
step: d3_svg_lineStep,
'step-before': d3_svg_lineStepBefore,
'step-after': d3_svg_lineStepAfter,
basis: d3_svg_lineBasis,
'basis-open': d3_svg_lineBasisOpen,
'basis-closed': d3_svg_lineBasisClosed,
bundle: d3_svg_lineBundle,
cardinal: d3_svg_lineCardinal,
'cardinal-open': d3_svg_lineCardinalOpen,
'cardinal-closed': d3_svg_lineCardinalClosed,
monotone: d3_svg_lineMonotone
});
d3_svg_lineInterpolators.forEach(function (key, value) {
value.key = key;
value.closed = /-closed$/.test(key);
});
function d3_svg_lineLinear(points) {
return points.length > 1 ? points.join('L') : points + 'Z';
}
function d3_svg_lineLinearClosed(points) {
return points.join('L') + 'Z';
}
function d3_svg_lineStep(points) {
var i = 0, n = points.length, p = points[0], path = [
p[0],
',',
p[1]
];
while (++i < n)
path.push('H', (p[0] + (p = points[i])[0]) / 2, 'V', p[1]);
if (n > 1)
path.push('H', p[0]);
return path.join('');
}
function d3_svg_lineStepBefore(points) {
var i = 0, n = points.length, p = points[0], path = [
p[0],
',',
p[1]
];
while (++i < n)
path.push('V', (p = points[i])[1], 'H', p[0]);
return path.join('');
}
function d3_svg_lineStepAfter(points) {
var i = 0, n = points.length, p = points[0], path = [
p[0],
',',
p[1]
];
while (++i < n)
path.push('H', (p = points[i])[0], 'V', p[1]);
return path.join('');
}
function d3_svg_lineCardinalOpen(points, tension) {
return points.length < 4 ? d3_svg_lineLinear(points) : points[1] + d3_svg_lineHermite(points.slice(1, -1), d3_svg_lineCardinalTangents(points, tension));
}
function d3_svg_lineCardinalClosed(points, tension) {
return points.length < 3 ? d3_svg_lineLinearClosed(points) : points[0] + d3_svg_lineHermite((points.push(points[0]), points), d3_svg_lineCardinalTangents([points[points.length - 2]].concat(points, [points[1]]), tension));
}
function d3_svg_lineCardinal(points, tension) {
return points.length < 3 ? d3_svg_lineLinear(points) : points[0] + d3_svg_lineHermite(points, d3_svg_lineCardinalTangents(points, tension));
}
function d3_svg_lineHermite(points, tangents) {
if (tangents.length < 1 || points.length != tangents.length && points.length != tangents.length + 2) {
return d3_svg_lineLinear(points);
}
var quad = points.length != tangents.length, path = '', p0 = points[0], p = points[1], t0 = tangents[0], t = t0, pi = 1;
if (quad) {
path += 'Q' + (p[0] - t0[0] * 2 / 3) + ',' + (p[1] - t0[1] * 2 / 3) + ',' + p[0] + ',' + p[1];
p0 = points[1];
pi = 2;
}
if (tangents.length > 1) {
t = tangents[1];
p = points[pi];
pi++;
path += 'C' + (p0[0] + t0[0]) + ',' + (p0[1] + t0[1]) + ',' + (p[0] - t[0]) + ',' + (p[1] - t[1]) + ',' + p[0] + ',' + p[1];
for (var i = 2; i < tangents.length; i++, pi++) {
p = points[pi];
t = tangents[i];
path += 'S' + (p[0] - t[0]) + ',' + (p[1] - t[1]) + ',' + p[0] + ',' + p[1];
}
}
if (quad) {
var lp = points[pi];
path += 'Q' + (p[0] + t[0] * 2 / 3) + ',' + (p[1] + t[1] * 2 / 3) + ',' + lp[0] + ',' + lp[1];
}
return path;
}
function d3_svg_lineCardinalTangents(points, tension) {
var tangents = [], a = (1 - tension) / 2, p0, p1 = points[0], p2 = points[1], i = 1, n = points.length;
while (++i < n) {
p0 = p1;
p1 = p2;
p2 = points[i];
tangents.push([
a * (p2[0] - p0[0]),
a * (p2[1] - p0[1])
]);
}
return tangents;
}
function d3_svg_lineBasis(points) {
if (points.length < 3)
return d3_svg_lineLinear(points);
var i = 1, n = points.length, pi = points[0], x0 = pi[0], y0 = pi[1], px = [
x0,
x0,
x0,
(pi = points[1])[0]
], py = [
y0,
y0,
y0,
pi[1]
], path = [
x0,
',',
y0,
'L',
d3_svg_lineDot4(d3_svg_lineBasisBezier3, px),
',',
d3_svg_lineDot4(d3_svg_lineBasisBezier3, py)
];
points.push(points[n - 1]);
while (++i <= n) {
pi = points[i];
px.shift();
px.push(pi[0]);
py.shift();
py.push(pi[1]);
d3_svg_lineBasisBezier(path, px, py);
}
points.pop();
path.push('L', pi);
return path.join('');
}
function d3_svg_lineBasisOpen(points) {
if (points.length < 4)
return d3_svg_lineLinear(points);
var path = [], i = -1, n = points.length, pi, px = [0], py = [0];
while (++i < 3) {
pi = points[i];
px.push(pi[0]);
py.push(pi[1]);
}
path.push(d3_svg_lineDot4(d3_svg_lineBasisBezier3, px) + ',' + d3_svg_lineDot4(d3_svg_lineBasisBezier3, py));
--i;
while (++i < n) {
pi = points[i];
px.shift();
px.push(pi[0]);
py.shift();
py.push(pi[1]);
d3_svg_lineBasisBezier(path, px, py);
}
return path.join('');
}
function d3_svg_lineBasisClosed(points) {
var path, i = -1, n = points.length, m = n + 4, pi, px = [], py = [];
while (++i < 4) {
pi = points[i % n];
px.push(pi[0]);
py.push(pi[1]);
}
path = [
d3_svg_lineDot4(d3_svg_lineBasisBezier3, px),
',',
d3_svg_lineDot4(d3_svg_lineBasisBezier3, py)
];
--i;
while (++i < m) {
pi = points[i % n];
px.shift();
px.push(pi[0]);
py.shift();
py.push(pi[1]);
d3_svg_lineBasisBezier(path, px, py);
}
return path.join('');
}
function d3_svg_lineBundle(points, tension) {
var n = points.length - 1;
if (n) {
var x0 = points[0][0], y0 = points[0][1], dx = points[n][0] - x0, dy = points[n][1] - y0, i = -1, p, t;
while (++i <= n) {
p = points[i];
t = i / n;
p[0] = tension * p[0] + (1 - tension) * (x0 + t * dx);
p[1] = tension * p[1] + (1 - tension) * (y0 + t * dy);
}
}
return d3_svg_lineBasis(points);
}
function d3_svg_lineDot4(a, b) {
return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}
var d3_svg_lineBasisBezier1 = [
0,
2 / 3,
1 / 3,
0
], d3_svg_lineBasisBezier2 = [
0,
1 / 3,
2 / 3,
0
], d3_svg_lineBasisBezier3 = [
0,
1 / 6,
2 / 3,
1 / 6
];
function d3_svg_lineBasisBezier(path, x, y) {
path.push('C', d3_svg_lineDot4(d3_svg_lineBasisBezier1, x), ',', d3_svg_lineDot4(d3_svg_lineBasisBezier1, y), ',', d3_svg_lineDot4(d3_svg_lineBasisBezier2, x), ',', d3_svg_lineDot4(d3_svg_lineBasisBezier2, y), ',', d3_svg_lineDot4(d3_svg_lineBasisBezier3, x), ',', d3_svg_lineDot4(d3_svg_lineBasisBezier3, y));
}
function d3_svg_lineSlope(p0, p1) {
return (p1[1] - p0[1]) / (p1[0] - p0[0]);
}
function d3_svg_lineFiniteDifferences(points) {
var i = 0, j = points.length - 1, m = [], p0 = points[0], p1 = points[1], d = m[0] = d3_svg_lineSlope(p0, p1);
while (++i < j) {
m[i] = (d + (d = d3_svg_lineSlope(p0 = p1, p1 = points[i + 1]))) / 2;
}
m[i] = d;
return m;
}
function d3_svg_lineMonotoneTangents(points) {
var tangents = [], d, a, b, s, m = d3_svg_lineFiniteDifferences(points), i = -1, j = points.length - 1;
while (++i < j) {
d = d3_svg_lineSlope(points[i], points[i + 1]);
if (abs(d) < ε) {
m[i] = m[i + 1] = 0;
} else {
a = m[i] / d;
b = m[i + 1] / d;
s = a * a + b * b;
if (s > 9) {
s = d * 3 / Math.sqrt(s);
m[i] = s * a;
m[i + 1] = s * b;
}
}
}
i = -1;
while (++i <= j) {
s = (points[Math.min(j, i + 1)][0] - points[Math.max(0, i - 1)][0]) / (6 * (1 + m[i] * m[i]));
tangents.push([
s || 0,
m[i] * s || 0
]);
}
return tangents;
}
function d3_svg_lineMonotone(points) {
return points.length < 3 ? d3_svg_lineLinear(points) : points[0] + d3_svg_lineHermite(points, d3_svg_lineMonotoneTangents(points));
}
d3.svg.line.radial = function () {
var line = d3_svg_line(d3_svg_lineRadial);
line.radius = line.x, delete line.x;
line.angle = line.y, delete line.y;
return line;
};
function d3_svg_lineRadial(points) {
var point, i = -1, n = points.length, r, a;
while (++i < n) {
point = points[i];
r = point[0];
a = point[1] - halfπ;
point[0] = r * Math.cos(a);
point[1] = r * Math.sin(a);
}
return points;
}
function d3_svg_area(projection) {
var x0 = d3_geom_pointX, x1 = d3_geom_pointX, y0 = 0, y1 = d3_geom_pointY, defined = d3_true, interpolate = d3_svg_lineLinear, interpolateKey = interpolate.key, interpolateReverse = interpolate, L = 'L', tension = 0.7;
function area(data) {
var segments = [], points0 = [], points1 = [], i = -1, n = data.length, d, fx0 = d3_functor(x0), fy0 = d3_functor(y0), fx1 = x0 === x1 ? function () {
return x;
} : d3_functor(x1), fy1 = y0 === y1 ? function () {
return y;
} : d3_functor(y1), x, y;
function segment() {
segments.push('M', interpolate(projection(points1), tension), L, interpolateReverse(projection(points0.reverse()), tension), 'Z');
}
while (++i < n) {
if (defined.call(this, d = data[i], i)) {
points0.push([
x = +fx0.call(this, d, i),
y = +fy0.call(this, d, i)
]);
points1.push([
+fx1.call(this, d, i),
+fy1.call(this, d, i)
]);
} else if (points0.length) {
segment();
points0 = [];
points1 = [];
}
}
if (points0.length)
segment();
return segments.length ? segments.join('') : null;
}
area.x = function (_) {
if (!arguments.length)
return x1;
x0 = x1 = _;
return area;
};
area.x0 = function (_) {
if (!arguments.length)
return x0;
x0 = _;
return area;
};
area.x1 = function (_) {
if (!arguments.length)
return x1;
x1 = _;
return area;
};
area.y = function (_) {
if (!arguments.length)
return y1;
y0 = y1 = _;
return area;
};
area.y0 = function (_) {
if (!arguments.length)
return y0;
y0 = _;
return area;
};
area.y1 = function (_) {
if (!arguments.length)
return y1;
y1 = _;
return area;
};
area.defined = function (_) {
if (!arguments.length)
return defined;
defined = _;
return area;
};
area.interpolate = function (_) {
if (!arguments.length)
return interpolateKey;
if (typeof _ === 'function')
interpolateKey = interpolate = _;
else
interpolateKey = (interpolate = d3_svg_lineInterpolators.get(_) || d3_svg_lineLinear).key;
interpolateReverse = interpolate.reverse || interpolate;
L = interpolate.closed ? 'M' : 'L';
return area;
};
area.tension = function (_) {
if (!arguments.length)
return tension;
tension = _;
return area;
};
return area;
}
d3_svg_lineStepBefore.reverse = d3_svg_lineStepAfter;
d3_svg_lineStepAfter.reverse = d3_svg_lineStepBefore;
d3.svg.area = function () {
return d3_svg_area(d3_identity);
};
d3.svg.area.radial = function () {
var area = d3_svg_area(d3_svg_lineRadial);
area.radius = area.x, delete area.x;
area.innerRadius = area.x0, delete area.x0;
area.outerRadius = area.x1, delete area.x1;
area.angle = area.y, delete area.y;
area.startAngle = area.y0, delete area.y0;
area.endAngle = area.y1, delete area.y1;
return area;
};
d3.svg.chord = function () {
var source = d3_source, target = d3_target, radius = d3_svg_chordRadius, startAngle = d3_svg_arcStartAngle, endAngle = d3_svg_arcEndAngle;
function chord(d, i) {
var s = subgroup(this, source, d, i), t = subgroup(this, target, d, i);
return 'M' + s.p0 + arc(s.r, s.p1, s.a1 - s.a0) + (equals(s, t) ? curve(s.r, s.p1, s.r, s.p0) : curve(s.r, s.p1, t.r, t.p0) + arc(t.r, t.p1, t.a1 - t.a0) + curve(t.r, t.p1, s.r, s.p0)) + 'Z';
}
function subgroup(self, f, d, i) {
var subgroup = f.call(self, d, i), r = radius.call(self, subgroup, i), a0 = startAngle.call(self, subgroup, i) - halfπ, a1 = endAngle.call(self, subgroup, i) - halfπ;
return {
r: r,
a0: a0,
a1: a1,
p0: [
r * Math.cos(a0),
r * Math.sin(a0)
],
p1: [
r * Math.cos(a1),
r * Math.sin(a1)
]
};
}
function equals(a, b) {
return a.a0 == b.a0 && a.a1 == b.a1;
}
function arc(r, p, a) {
return 'A' + r + ',' + r + ' 0 ' + +(a > π) + ',1 ' + p;
}
function curve(r0, p0, r1, p1) {
return 'Q 0,0 ' + p1;
}
chord.radius = function (v) {
if (!arguments.length)
return radius;
radius = d3_functor(v);
return chord;
};
chord.source = function (v) {
if (!arguments.length)
return source;
source = d3_functor(v);
return chord;
};
chord.target = function (v) {
if (!arguments.length)
return target;
target = d3_functor(v);
return chord;
};
chord.startAngle = function (v) {
if (!arguments.length)
return startAngle;
startAngle = d3_functor(v);
return chord;
};
chord.endAngle = function (v) {
if (!arguments.length)
return endAngle;
endAngle = d3_functor(v);
return chord;
};
return chord;
};
function d3_svg_chordRadius(d) {
return d.radius;
}
d3.svg.diagonal = function () {
var source = d3_source, target = d3_target, projection = d3_svg_diagonalProjection;
function diagonal(d, i) {
var p0 = source.call(this, d, i), p3 = target.call(this, d, i), m = (p0.y + p3.y) / 2, p = [
p0,
{
x: p0.x,
y: m
},
{
x: p3.x,
y: m
},
p3
];
p = p.map(projection);
return 'M' + p[0] + 'C' + p[1] + ' ' + p[2] + ' ' + p[3];
}
diagonal.source = function (x) {
if (!arguments.length)
return source;
source = d3_functor(x);
return diagonal;
};
diagonal.target = function (x) {
if (!arguments.length)
return target;
target = d3_functor(x);
return diagonal;
};
diagonal.projection = function (x) {
if (!arguments.length)
return projection;
projection = x;
return diagonal;
};
return diagonal;
};
function d3_svg_diagonalProjection(d) {
return [
d.x,
d.y
];
}
d3.svg.diagonal.radial = function () {
var diagonal = d3.svg.diagonal(), projection = d3_svg_diagonalProjection, projection_ = diagonal.projection;
diagonal.projection = function (x) {
return arguments.length ? projection_(d3_svg_diagonalRadialProjection(projection = x)) : projection;
};
return diagonal;
};
function d3_svg_diagonalRadialProjection(projection) {
return function () {
var d = projection.apply(this, arguments), r = d[0], a = d[1] - halfπ;
return [
r * Math.cos(a),
r * Math.sin(a)
];
};
}
d3.svg.symbol = function () {
var type = d3_svg_symbolType, size = d3_svg_symbolSize;
function symbol(d, i) {
return (d3_svg_symbols.get(type.call(this, d, i)) || d3_svg_symbolCircle)(size.call(this, d, i));
}
symbol.type = function (x) {
if (!arguments.length)
return type;
type = d3_functor(x);
return symbol;
};
symbol.size = function (x) {
if (!arguments.length)
return size;
size = d3_functor(x);
return symbol;
};
return symbol;
};
function d3_svg_symbolSize() {
return 64;
}
function d3_svg_symbolType() {
return 'circle';
}
function d3_svg_symbolCircle(size) {
var r = Math.sqrt(size / π);
return 'M0,' + r + 'A' + r + ',' + r + ' 0 1,1 0,' + -r + 'A' + r + ',' + r + ' 0 1,1 0,' + r + 'Z';
}
var d3_svg_symbols = d3.map({
circle: d3_svg_symbolCircle,
cross: function (size) {
var r = Math.sqrt(size / 5) / 2;
return 'M' + -3 * r + ',' + -r + 'H' + -r + 'V' + -3 * r + 'H' + r + 'V' + -r + 'H' + 3 * r + 'V' + r + 'H' + r + 'V' + 3 * r + 'H' + -r + 'V' + r + 'H' + -3 * r + 'Z';
},
diamond: function (size) {
var ry = Math.sqrt(size / (2 * d3_svg_symbolTan30)), rx = ry * d3_svg_symbolTan30;
return 'M0,' + -ry + 'L' + rx + ',0' + ' 0,' + ry + ' ' + -rx + ',0' + 'Z';
},
square: function (size) {
var r = Math.sqrt(size) / 2;
return 'M' + -r + ',' + -r + 'L' + r + ',' + -r + ' ' + r + ',' + r + ' ' + -r + ',' + r + 'Z';
},
'triangle-down': function (size) {
var rx = Math.sqrt(size / d3_svg_symbolSqrt3), ry = rx * d3_svg_symbolSqrt3 / 2;
return 'M0,' + ry + 'L' + rx + ',' + -ry + ' ' + -rx + ',' + -ry + 'Z';
},
'triangle-up': function (size) {
var rx = Math.sqrt(size / d3_svg_symbolSqrt3), ry = rx * d3_svg_symbolSqrt3 / 2;
return 'M0,' + -ry + 'L' + rx + ',' + ry + ' ' + -rx + ',' + ry + 'Z';
}
});
d3.svg.symbolTypes = d3_svg_symbols.keys();
var d3_svg_symbolSqrt3 = Math.sqrt(3), d3_svg_symbolTan30 = Math.tan(30 * d3_radians);
d3_selectionPrototype.transition = function (name) {
var id = d3_transitionInheritId || ++d3_transitionId, ns = d3_transitionNamespace(name), subgroups = [], subgroup, node, transition = d3_transitionInherit || {
time: Date.now(),
ease: d3_ease_cubicInOut,
delay: 0,
duration: 250
};
for (var j = -1, m = this.length; ++j < m;) {
subgroups.push(subgroup = []);
for (var group = this[j], i = -1, n = group.length; ++i < n;) {
if (node = group[i])
d3_transitionNode(node, i, ns, id, transition);
subgroup.push(node);
}
}
return d3_transition(subgroups, ns, id);
};
d3_selectionPrototype.interrupt = function (name) {
return this.each(name == null ? d3_selection_interrupt : d3_selection_interruptNS(d3_transitionNamespace(name)));
};
var d3_selection_interrupt = d3_selection_interruptNS(d3_transitionNamespace());
function d3_selection_interruptNS(ns) {
return function () {
var lock, activeId, active;
if ((lock = this[ns]) && (active = lock[activeId = lock.active])) {
active.timer.c = null;
active.timer.t = NaN;
if (--lock.count)
delete lock[activeId];
else
delete this[ns];
lock.active += 0.5;
active.event && active.event.interrupt.call(this, this.__data__, active.index);
}
};
}
function d3_transition(groups, ns, id) {
d3_subclass(groups, d3_transitionPrototype);
groups.namespace = ns;
groups.id = id;
return groups;
}
var d3_transitionPrototype = [], d3_transitionId = 0, d3_transitionInheritId, d3_transitionInherit;
d3_transitionPrototype.call = d3_selectionPrototype.call;
d3_transitionPrototype.empty = d3_selectionPrototype.empty;
d3_transitionPrototype.node = d3_selectionPrototype.node;
d3_transitionPrototype.size = d3_selectionPrototype.size;
d3.transition = function (selection, name) {
return selection && selection.transition ? d3_transitionInheritId ? selection.transition(name) : selection : d3.selection().transition(selection);
};
d3.transition.prototype = d3_transitionPrototype;
d3_transitionPrototype.select = function (selector) {
var id = this.id, ns = this.namespace, subgroups = [], subgroup, subnode, node;
selector = d3_selection_selector(selector);
for (var j = -1, m = this.length; ++j < m;) {
subgroups.push(subgroup = []);
for (var group = this[j], i = -1, n = group.length; ++i < n;) {
if ((node = group[i]) && (subnode = selector.call(node, node.__data__, i, j))) {
if ('__data__' in node)
subnode.__data__ = node.__data__;
d3_transitionNode(subnode, i, ns, id, node[ns][id]);
subgroup.push(subnode);
} else {
subgroup.push(null);
}
}
}
return d3_transition(subgroups, ns, id);
};
d3_transitionPrototype.selectAll = function (selector) {
var id = this.id, ns = this.namespace, subgroups = [], subgroup, subnodes, node, subnode, transition;
selector = d3_selection_selectorAll(selector);
for (var j = -1, m = this.length; ++j < m;) {
for (var group = this[j], i = -1, n = group.length; ++i < n;) {
if (node = group[i]) {
transition = node[ns][id];
subnodes = selector.call(node, node.__data__, i, j);
subgroups.push(subgroup = []);
for (var k = -1, o = subnodes.length; ++k < o;) {
if (subnode = subnodes[k])
d3_transitionNode(subnode, k, ns, id, transition);
subgroup.push(subnode);
}
}
}
}
return d3_transition(subgroups, ns, id);
};
d3_transitionPrototype.filter = function (filter) {
var subgroups = [], subgroup, group, node;
if (typeof filter !== 'function')
filter = d3_selection_filter(filter);
for (var j = 0, m = this.length; j < m; j++) {
subgroups.push(subgroup = []);
for (var group = this[j], i = 0, n = group.length; i < n; i++) {
if ((node = group[i]) && filter.call(node, node.__data__, i, j)) {
subgroup.push(node);
}
}
}
return d3_transition(subgroups, this.namespace, this.id);
};
d3_transitionPrototype.tween = function (name, tween) {
var id = this.id, ns = this.namespace;
if (arguments.length < 2)
return this.node()[ns][id].tween.get(name);
return d3_selection_each(this, tween == null ? function (node) {
node[ns][id].tween.remove(name);
} : function (node) {
node[ns][id].tween.set(name, tween);
});
};
function d3_transition_tween(groups, name, value, tween) {
var id = groups.id, ns = groups.namespace;
return d3_selection_each(groups, typeof value === 'function' ? function (node, i, j) {
node[ns][id].tween.set(name, tween(value.call(node, node.__data__, i, j)));
} : (value = tween(value), function (node) {
node[ns][id].tween.set(name, value);
}));
}
d3_transitionPrototype.attr = function (nameNS, value) {
if (arguments.length < 2) {
for (value in nameNS)
this.attr(value, nameNS[value]);
return this;
}
var interpolate = nameNS == 'transform' ? d3_interpolateTransform : d3_interpolate, name = d3.ns.qualify(nameNS);
function attrNull() {
this.removeAttribute(name);
}
function attrNullNS() {
this.removeAttributeNS(name.space, name.local);
}
function attrTween(b) {
return b == null ? attrNull : (b += '', function () {
var a = this.getAttribute(name), i;
return a !== b && (i = interpolate(a, b), function (t) {
this.setAttribute(name, i(t));
});
});
}
function attrTweenNS(b) {
return b == null ? attrNullNS : (b += '', function () {
var a = this.getAttributeNS(name.space, name.local), i;
return a !== b && (i = interpolate(a, b), function (t) {
this.setAttributeNS(name.space, name.local, i(t));
});
});
}
return d3_transition_tween(this, 'attr.' + nameNS, value, name.local ? attrTweenNS : attrTween);
};
d3_transitionPrototype.attrTween = function (nameNS, tween) {
var name = d3.ns.qualify(nameNS);
function attrTween(d, i) {
var f = tween.call(this, d, i, this.getAttribute(name));
return f && function (t) {
this.setAttribute(name, f(t));
};
}
function attrTweenNS(d, i) {
var f = tween.call(this, d, i, this.getAttributeNS(name.space, name.local));
return f && function (t) {
this.setAttributeNS(name.space, name.local, f(t));
};
}
return this.tween('attr.' + nameNS, name.local ? attrTweenNS : attrTween);
};
d3_transitionPrototype.style = function (name, value, priority) {
var n = arguments.length;
if (n < 3) {
if (typeof name !== 'string') {
if (n < 2)
value = '';
for (priority in name)
this.style(priority, name[priority], value);
return this;
}
priority = '';
}
function styleNull() {
this.style.removeProperty(name);
}
function styleString(b) {
return b == null ? styleNull : (b += '', function () {
var a = d3_window(this).getComputedStyle(this, null).getPropertyValue(name), i;
return a !== b && (i = d3_interpolate(a, b), function (t) {
this.style.setProperty(name, i(t), priority);
});
});
}
return d3_transition_tween(this, 'style.' + name, value, styleString);
};
d3_transitionPrototype.styleTween = function (name, tween, priority) {
if (arguments.length < 3)
priority = '';
function styleTween(d, i) {
var f = tween.call(this, d, i, d3_window(this).getComputedStyle(this, null).getPropertyValue(name));
return f && function (t) {
this.style.setProperty(name, f(t), priority);
};
}
return this.tween('style.' + name, styleTween);
};
d3_transitionPrototype.text = function (value) {
return d3_transition_tween(this, 'text', value, d3_transition_text);
};
function d3_transition_text(b) {
if (b == null)
b = '';
return function () {
this.textContent = b;
};
}
d3_transitionPrototype.remove = function () {
var ns = this.namespace;
return this.each('end.transition', function () {
var p;
if (this[ns].count < 2 && (p = this.parentNode))
p.removeChild(this);
});
};
d3_transitionPrototype.ease = function (value) {
var id = this.id, ns = this.namespace;
if (arguments.length < 1)
return this.node()[ns][id].ease;
if (typeof value !== 'function')
value = d3.ease.apply(d3, arguments);
return d3_selection_each(this, function (node) {
node[ns][id].ease = value;
});
};
d3_transitionPrototype.delay = function (value) {
var id = this.id, ns = this.namespace;
if (arguments.length < 1)
return this.node()[ns][id].delay;
return d3_selection_each(this, typeof value === 'function' ? function (node, i, j) {
node[ns][id].delay = +value.call(node, node.__data__, i, j);
} : (value = +value, function (node) {
node[ns][id].delay = value;
}));
};
d3_transitionPrototype.duration = function (value) {
var id = this.id, ns = this.namespace;
if (arguments.length < 1)
return this.node()[ns][id].duration;
return d3_selection_each(this, typeof value === 'function' ? function (node, i, j) {
node[ns][id].duration = Math.max(1, value.call(node, node.__data__, i, j));
} : (value = Math.max(1, value), function (node) {
node[ns][id].duration = value;
}));
};
d3_transitionPrototype.each = function (type, listener) {
var id = this.id, ns = this.namespace;
if (arguments.length < 2) {
var inherit = d3_transitionInherit, inheritId = d3_transitionInheritId;
try {
d3_transitionInheritId = id;
d3_selection_each(this, function (node, i, j) {
d3_transitionInherit = node[ns][id];
type.call(node, node.__data__, i, j);
});
} finally {
d3_transitionInherit = inherit;
d3_transitionInheritId = inheritId;
}
} else {
d3_selection_each(this, function (node) {
var transition = node[ns][id];
(transition.event || (transition.event = d3.dispatch('start', 'end', 'interrupt'))).on(type, listener);
});
}
return this;
};
d3_transitionPrototype.transition = function () {
var id0 = this.id, id1 = ++d3_transitionId, ns = this.namespace, subgroups = [], subgroup, group, node, transition;
for (var j = 0, m = this.length; j < m; j++) {
subgroups.push(subgroup = []);
for (var group = this[j], i = 0, n = group.length; i < n; i++) {
if (node = group[i]) {
transition = node[ns][id0];
d3_transitionNode(node, i, ns, id1, {
time: transition.time,
ease: transition.ease,
delay: transition.delay + transition.duration,
duration: transition.duration
});
}
subgroup.push(node);
}
}
return d3_transition(subgroups, ns, id1);
};
function d3_transitionNamespace(name) {
return name == null ? '__transition__' : '__transition_' + name + '__';
}
function d3_transitionNode(node, i, ns, id, inherit) {
var lock = node[ns] || (node[ns] = {
active: 0,
count: 0
}), transition = lock[id], time, timer, duration, ease, tweens;
function schedule(elapsed) {
var delay = transition.delay;
timer.t = delay + time;
if (delay <= elapsed)
return start(elapsed - delay);
timer.c = start;
}
function start(elapsed) {
var activeId = lock.active, active = lock[activeId];
if (active) {
active.timer.c = null;
active.timer.t = NaN;
--lock.count;
delete lock[activeId];
active.event && active.event.interrupt.call(node, node.__data__, active.index);
}
for (var cancelId in lock) {
if (+cancelId < id) {
var cancel = lock[cancelId];
cancel.timer.c = null;
cancel.timer.t = NaN;
--lock.count;
delete lock[cancelId];
}
}
timer.c = tick;
d3_timer(function () {
if (timer.c && tick(elapsed || 1)) {
timer.c = null;
timer.t = NaN;
}
return 1;
}, 0, time);
lock.active = id;
transition.event && transition.event.start.call(node, node.__data__, i);
tweens = [];
transition.tween.forEach(function (key, value) {
if (value = value.call(node, node.__data__, i)) {
tweens.push(value);
}
});
ease = transition.ease;
duration = transition.duration;
}
function tick(elapsed) {
var t = elapsed / duration, e = ease(t), n = tweens.length;
while (n > 0) {
tweens[--n].call(node, e);
}
if (t >= 1) {
transition.event && transition.event.end.call(node, node.__data__, i);
if (--lock.count)
delete lock[id];
else
delete node[ns];
return 1;
}
}
if (!transition) {
time = inherit.time;
timer = d3_timer(schedule, 0, time);
transition = lock[id] = {
tween: new d3_Map(),
time: time,
timer: timer,
delay: inherit.delay,
duration: inherit.duration,
ease: inherit.ease,
index: i
};
inherit = null;
++lock.count;
}
}
d3.svg.axis = function () {
var scale = d3.scale.linear(), orient = d3_svg_axisDefaultOrient, innerTickSize = 6, outerTickSize = 6, tickPadding = 3, tickArguments_ = [10], tickValues = null, tickFormat_;
function axis(g) {
g.each(function () {
var g = d3.select(this);
var scale0 = this.__chart__ || scale, scale1 = this.__chart__ = scale.copy();
var ticks = tickValues == null ? scale1.ticks ? scale1.ticks.apply(scale1, tickArguments_) : scale1.domain() : tickValues, tickFormat = tickFormat_ == null ? scale1.tickFormat ? scale1.tickFormat.apply(scale1, tickArguments_) : d3_identity : tickFormat_, tick = g.selectAll('.tick').data(ticks, scale1), tickEnter = tick.enter().insert('g', '.domain').attr('class', 'tick').style('opacity', ε), tickExit = d3.transition(tick.exit()).style('opacity', ε).remove(), tickUpdate = d3.transition(tick.order()).style('opacity', 1), tickSpacing = Math.max(innerTickSize, 0) + tickPadding, tickTransform;
var range = d3_scaleRange(scale1), path = g.selectAll('.domain').data([0]), pathUpdate = (path.enter().append('path').attr('class', 'domain'), d3.transition(path));
tickEnter.append('line');
tickEnter.append('text');
var lineEnter = tickEnter.select('line'), lineUpdate = tickUpdate.select('line'), text = tick.select('text').text(tickFormat), textEnter = tickEnter.select('text'), textUpdate = tickUpdate.select('text'), sign = orient === 'top' || orient === 'left' ? -1 : 1, x1, x2, y1, y2;
if (orient === 'bottom' || orient === 'top') {
tickTransform = d3_svg_axisX, x1 = 'x', y1 = 'y', x2 = 'x2', y2 = 'y2';
text.attr('dy', sign < 0 ? '0em' : '.71em').style('text-anchor', 'middle');
pathUpdate.attr('d', 'M' + range[0] + ',' + sign * outerTickSize + 'V0H' + range[1] + 'V' + sign * outerTickSize);
} else {
tickTransform = d3_svg_axisY, x1 = 'y', y1 = 'x', x2 = 'y2', y2 = 'x2';
text.attr('dy', '.32em').style('text-anchor', sign < 0 ? 'end' : 'start');
pathUpdate.attr('d', 'M' + sign * outerTickSize + ',' + range[0] + 'H0V' + range[1] + 'H' + sign * outerTickSize);
}
lineEnter.attr(y2, sign * innerTickSize);
textEnter.attr(y1, sign * tickSpacing);
lineUpdate.attr(x2, 0).attr(y2, sign * innerTickSize);
textUpdate.attr(x1, 0).attr(y1, sign * tickSpacing);
if (scale1.rangeBand) {
var x = scale1, dx = x.rangeBand() / 2;
scale0 = scale1 = function (d) {
return x(d) + dx;
};
} else if (scale0.rangeBand) {
scale0 = scale1;
} else {
tickExit.call(tickTransform, scale1, scale0);
}
tickEnter.call(tickTransform, scale0, scale1);
tickUpdate.call(tickTransform, scale1, scale1);
});
}
axis.scale = function (x) {
if (!arguments.length)
return scale;
scale = x;
return axis;
};
axis.orient = function (x) {
if (!arguments.length)
return orient;
orient = x in d3_svg_axisOrients ? x + '' : d3_svg_axisDefaultOrient;
return axis;
};
axis.ticks = function () {
if (!arguments.length)
return tickArguments_;
tickArguments_ = d3_array(arguments);
return axis;
};
axis.tickValues = function (x) {
if (!arguments.length)
return tickValues;
tickValues = x;
return axis;
};
axis.tickFormat = function (x) {
if (!arguments.length)
return tickFormat_;
tickFormat_ = x;
return axis;
};
axis.tickSize = function (x) {
var n = arguments.length;
if (!n)
return innerTickSize;
innerTickSize = +x;
outerTickSize = +arguments[n - 1];
return axis;
};
axis.innerTickSize = function (x) {
if (!arguments.length)
return innerTickSize;
innerTickSize = +x;
return axis;
};
axis.outerTickSize = function (x) {
if (!arguments.length)
return outerTickSize;
outerTickSize = +x;
return axis;
};
axis.tickPadding = function (x) {
if (!arguments.length)
return tickPadding;
tickPadding = +x;
return axis;
};
axis.tickSubdivide = function () {
return arguments.length && axis;
};
return axis;
};
var d3_svg_axisDefaultOrient = 'bottom', d3_svg_axisOrients = {
top: 1,
right: 1,
bottom: 1,
left: 1
};
function d3_svg_axisX(selection, x0, x1) {
selection.attr('transform', function (d) {
var v0 = x0(d);
return 'translate(' + (isFinite(v0) ? v0 : x1(d)) + ',0)';
});
}
function d3_svg_axisY(selection, y0, y1) {
selection.attr('transform', function (d) {
var v0 = y0(d);
return 'translate(0,' + (isFinite(v0) ? v0 : y1(d)) + ')';
});
}
d3.svg.brush = function () {
var event = d3_eventDispatch(brush, 'brushstart', 'brush', 'brushend'), x = null, y = null, xExtent = [
0,
0
], yExtent = [
0,
0
], xExtentDomain, yExtentDomain, xClamp = true, yClamp = true, resizes = d3_svg_brushResizes[0];
function brush(g) {
g.each(function () {
var g = d3.select(this).style('pointer-events', 'all').style('-webkit-tap-highlight-color', 'rgba(0,0,0,0)').on('mousedown.brush', brushstart).on('touchstart.brush', brushstart);
var background = g.selectAll('.background').data([0]);
background.enter().append('rect').attr('class', 'background').style('visibility', 'hidden').style('cursor', 'crosshair');
g.selectAll('.extent').data([0]).enter().append('rect').attr('class', 'extent').style('cursor', 'move');
var resize = g.selectAll('.resize').data(resizes, d3_identity);
resize.exit().remove();
resize.enter().append('g').attr('class', function (d) {
return 'resize ' + d;
}).style('cursor', function (d) {
return d3_svg_brushCursor[d];
}).append('rect').attr('x', function (d) {
return /[ew]$/.test(d) ? -3 : null;
}).attr('y', function (d) {
return /^[ns]/.test(d) ? -3 : null;
}).attr('width', 6).attr('height', 6).style('visibility', 'hidden');
resize.style('display', brush.empty() ? 'none' : null);
var gUpdate = d3.transition(g), backgroundUpdate = d3.transition(background), range;
if (x) {
range = d3_scaleRange(x);
backgroundUpdate.attr('x', range[0]).attr('width', range[1] - range[0]);
redrawX(gUpdate);
}
if (y) {
range = d3_scaleRange(y);
backgroundUpdate.attr('y', range[0]).attr('height', range[1] - range[0]);
redrawY(gUpdate);
}
redraw(gUpdate);
});
}
brush.event = function (g) {
g.each(function () {
var event_ = event.of(this, arguments), extent1 = {
x: xExtent,
y: yExtent,
i: xExtentDomain,
j: yExtentDomain
}, extent0 = this.__chart__ || extent1;
this.__chart__ = extent1;
if (d3_transitionInheritId) {
d3.select(this).transition().each('start.brush', function () {
xExtentDomain = extent0.i;
yExtentDomain = extent0.j;
xExtent = extent0.x;
yExtent = extent0.y;
event_({ type: 'brushstart' });
}).tween('brush:brush', function () {
var xi = d3_interpolateArray(xExtent, extent1.x), yi = d3_interpolateArray(yExtent, extent1.y);
xExtentDomain = yExtentDomain = null;
return function (t) {
xExtent = extent1.x = xi(t);
yExtent = extent1.y = yi(t);
event_({
type: 'brush',
mode: 'resize'
});
};
}).each('end.brush', function () {
xExtentDomain = extent1.i;
yExtentDomain = extent1.j;
event_({
type: 'brush',
mode: 'resize'
});
event_({ type: 'brushend' });
});
} else {
event_({ type: 'brushstart' });
event_({
type: 'brush',
mode: 'resize'
});
event_({ type: 'brushend' });
}
});
};
function redraw(g) {
g.selectAll('.resize').attr('transform', function (d) {
return 'translate(' + xExtent[+/e$/.test(d)] + ',' + yExtent[+/^s/.test(d)] + ')';
});
}
function redrawX(g) {
g.select('.extent').attr('x', xExtent[0]);
g.selectAll('.extent,.n>rect,.s>rect').attr('width', xExtent[1] - xExtent[0]);
}
function redrawY(g) {
g.select('.extent').attr('y', yExtent[0]);
g.selectAll('.extent,.e>rect,.w>rect').attr('height', yExtent[1] - yExtent[0]);
}
function brushstart() {
var target = this, eventTarget = d3.select(d3.event.target), event_ = event.of(target, arguments), g = d3.select(target), resizing = eventTarget.datum(), resizingX = !/^(n|s)$/.test(resizing) && x, resizingY = !/^(e|w)$/.test(resizing) && y, dragging = eventTarget.classed('extent'), dragRestore = d3_event_dragSuppress(target), center, origin = d3.mouse(target), offset;
var w = d3.select(d3_window(target)).on('keydown.brush', keydown).on('keyup.brush', keyup);
if (d3.event.changedTouches) {
w.on('touchmove.brush', brushmove).on('touchend.brush', brushend);
} else {
w.on('mousemove.brush', brushmove).on('mouseup.brush', brushend);
}
g.interrupt().selectAll('*').interrupt();
if (dragging) {
origin[0] = xExtent[0] - origin[0];
origin[1] = yExtent[0] - origin[1];
} else if (resizing) {
var ex = +/w$/.test(resizing), ey = +/^n/.test(resizing);
offset = [
xExtent[1 - ex] - origin[0],
yExtent[1 - ey] - origin[1]
];
origin[0] = xExtent[ex];
origin[1] = yExtent[ey];
} else if (d3.event.altKey)
center = origin.slice();
g.style('pointer-events', 'none').selectAll('.resize').style('display', null);
d3.select('body').style('cursor', eventTarget.style('cursor'));
event_({ type: 'brushstart' });
brushmove();
function keydown() {
if (d3.event.keyCode == 32) {
if (!dragging) {
center = null;
origin[0] -= xExtent[1];
origin[1] -= yExtent[1];
dragging = 2;
}
d3_eventPreventDefault();
}
}
function keyup() {
if (d3.event.keyCode == 32 && dragging == 2) {
origin[0] += xExtent[1];
origin[1] += yExtent[1];
dragging = 0;
d3_eventPreventDefault();
}
}
function brushmove() {
var point = d3.mouse(target), moved = false;
if (offset) {
point[0] += offset[0];
point[1] += offset[1];
}
if (!dragging) {
if (d3.event.altKey) {
if (!center)
center = [
(xExtent[0] + xExtent[1]) / 2,
(yExtent[0] + yExtent[1]) / 2
];
origin[0] = xExtent[+(point[0] < center[0])];
origin[1] = yExtent[+(point[1] < center[1])];
} else
center = null;
}
if (resizingX && move1(point, x, 0)) {
redrawX(g);
moved = true;
}
if (resizingY && move1(point, y, 1)) {
redrawY(g);
moved = true;
}
if (moved) {
redraw(g);
event_({
type: 'brush',
mode: dragging ? 'move' : 'resize'
});
}
}
function move1(point, scale, i) {
var range = d3_scaleRange(scale), r0 = range[0], r1 = range[1], position = origin[i], extent = i ? yExtent : xExtent, size = extent[1] - extent[0], min, max;
if (dragging) {
r0 -= position;
r1 -= size + position;
}
min = (i ? yClamp : xClamp) ? Math.max(r0, Math.min(r1, point[i])) : point[i];
if (dragging) {
max = (min += position) + size;
} else {
if (center)
position = Math.max(r0, Math.min(r1, 2 * center[i] - min));
if (position < min) {
max = min;
min = position;
} else {
max = position;
}
}
if (extent[0] != min || extent[1] != max) {
if (i)
yExtentDomain = null;
else
xExtentDomain = null;
extent[0] = min;
extent[1] = max;
return true;
}
}
function brushend() {
brushmove();
g.style('pointer-events', 'all').selectAll('.resize').style('display', brush.empty() ? 'none' : null);
d3.select('body').style('cursor', null);
w.on('mousemove.brush', null).on('mouseup.brush', null).on('touchmove.brush', null).on('touchend.brush', null).on('keydown.brush', null).on('keyup.brush', null);
dragRestore();
event_({ type: 'brushend' });
}
}
brush.x = function (z) {
if (!arguments.length)
return x;
x = z;
resizes = d3_svg_brushResizes[!x << 1 | !y];
return brush;
};
brush.y = function (z) {
if (!arguments.length)
return y;
y = z;
resizes = d3_svg_brushResizes[!x << 1 | !y];
return brush;
};
brush.clamp = function (z) {
if (!arguments.length)
return x && y ? [
xClamp,
yClamp
] : x ? xClamp : y ? yClamp : null;
if (x && y)
xClamp = !!z[0], yClamp = !!z[1];
else if (x)
xClamp = !!z;
else if (y)
yClamp = !!z;
return brush;
};
brush.extent = function (z) {
var x0, x1, y0, y1, t;
if (!arguments.length) {
if (x) {
if (xExtentDomain) {
x0 = xExtentDomain[0], x1 = xExtentDomain[1];
} else {
x0 = xExtent[0], x1 = xExtent[1];
if (x.invert)
x0 = x.invert(x0), x1 = x.invert(x1);
if (x1 < x0)
t = x0, x0 = x1, x1 = t;
}
}
if (y) {
if (yExtentDomain) {
y0 = yExtentDomain[0], y1 = yExtentDomain[1];
} else {
y0 = yExtent[0], y1 = yExtent[1];
if (y.invert)
y0 = y.invert(y0), y1 = y.invert(y1);
if (y1 < y0)
t = y0, y0 = y1, y1 = t;
}
}
return x && y ? [
[
x0,
y0
],
[
x1,
y1
]
] : x ? [
x0,
x1
] : y && [
y0,
y1
];
}
if (x) {
x0 = z[0], x1 = z[1];
if (y)
x0 = x0[0], x1 = x1[0];
xExtentDomain = [
x0,
x1
];
if (x.invert)
x0 = x(x0), x1 = x(x1);
if (x1 < x0)
t = x0, x0 = x1, x1 = t;
if (x0 != xExtent[0] || x1 != xExtent[1])
xExtent = [
x0,
x1
];
}
if (y) {
y0 = z[0], y1 = z[1];
if (x)
y0 = y0[1], y1 = y1[1];
yExtentDomain = [
y0,
y1
];
if (y.invert)
y0 = y(y0), y1 = y(y1);
if (y1 < y0)
t = y0, y0 = y1, y1 = t;
if (y0 != yExtent[0] || y1 != yExtent[1])
yExtent = [
y0,
y1
];
}
return brush;
};
brush.clear = function () {
if (!brush.empty()) {
xExtent = [
0,
0
], yExtent = [
0,
0
];
xExtentDomain = yExtentDomain = null;
}
return brush;
};
brush.empty = function () {
return !!x && xExtent[0] == xExtent[1] || !!y && yExtent[0] == yExtent[1];
};
return d3.rebind(brush, event, 'on');
};
var d3_svg_brushCursor = {
n: 'ns-resize',
e: 'ew-resize',
s: 'ns-resize',
w: 'ew-resize',
nw: 'nwse-resize',
ne: 'nesw-resize',
se: 'nwse-resize',
sw: 'nesw-resize'
};
var d3_svg_brushResizes = [
[
'n',
'e',
's',
'w',
'nw',
'ne',
'se',
'sw'
],
[
'e',
'w'
],
[
'n',
's'
],
[]
];
var d3_time_format = d3_time.format = d3_locale_enUS.timeFormat;
var d3_time_formatUtc = d3_time_format.utc;
var d3_time_formatIso = d3_time_formatUtc('%Y-%m-%dT%H:%M:%S.%LZ');
d3_time_format.iso = Date.prototype.toISOString && +new Date('2000-01-01T00:00:00.000Z') ? d3_time_formatIsoNative : d3_time_formatIso;
function d3_time_formatIsoNative(date) {
return date.toISOString();
}
d3_time_formatIsoNative.parse = function (string) {
var date = new Date(string);
return isNaN(date) ? null : date;
};
d3_time_formatIsoNative.toString = d3_time_formatIso.toString;
d3_time.second = d3_time_interval(function (date) {
return new d3_date(Math.floor(date / 1000) * 1000);
}, function (date, offset) {
date.setTime(date.getTime() + Math.floor(offset) * 1000);
}, function (date) {
return date.getSeconds();
});
d3_time.seconds = d3_time.second.range;
d3_time.seconds.utc = d3_time.second.utc.range;
d3_time.minute = d3_time_interval(function (date) {
return new d3_date(Math.floor(date / 60000) * 60000);
}, function (date, offset) {
date.setTime(date.getTime() + Math.floor(offset) * 60000);
}, function (date) {
return date.getMinutes();
});
d3_time.minutes = d3_time.minute.range;
d3_time.minutes.utc = d3_time.minute.utc.range;
d3_time.hour = d3_time_interval(function (date) {
var timezone = date.getTimezoneOffset() / 60;
return new d3_date((Math.floor(date / 3600000 - timezone) + timezone) * 3600000);
}, function (date, offset) {
date.setTime(date.getTime() + Math.floor(offset) * 3600000);
}, function (date) {
return date.getHours();
});
d3_time.hours = d3_time.hour.range;
d3_time.hours.utc = d3_time.hour.utc.range;
d3_time.month = d3_time_interval(function (date) {
date = d3_time.day(date);
date.setDate(1);
return date;
}, function (date, offset) {
date.setMonth(date.getMonth() + offset);
}, function (date) {
return date.getMonth();
});
d3_time.months = d3_time.month.range;
d3_time.months.utc = d3_time.month.utc.range;
function d3_time_scale(linear, methods, format) {
function scale(x) {
return linear(x);
}
scale.invert = function (x) {
return d3_time_scaleDate(linear.invert(x));
};
scale.domain = function (x) {
if (!arguments.length)
return linear.domain().map(d3_time_scaleDate);
linear.domain(x);
return scale;
};
function tickMethod(extent, count) {
var span = extent[1] - extent[0], target = span / count, i = d3.bisect(d3_time_scaleSteps, target);
return i == d3_time_scaleSteps.length ? [
methods.year,
d3_scale_linearTickRange(extent.map(function (d) {
return d / 31536000000;
}), count)[2]
] : !i ? [
d3_time_scaleMilliseconds,
d3_scale_linearTickRange(extent, count)[2]
] : methods[target / d3_time_scaleSteps[i - 1] < d3_time_scaleSteps[i] / target ? i - 1 : i];
}
scale.nice = function (interval, skip) {
var domain = scale.domain(), extent = d3_scaleExtent(domain), method = interval == null ? tickMethod(extent, 10) : typeof interval === 'number' && tickMethod(extent, interval);
if (method)
interval = method[0], skip = method[1];
function skipped(date) {
return !isNaN(date) && !interval.range(date, d3_time_scaleDate(+date + 1), skip).length;
}
return scale.domain(d3_scale_nice(domain, skip > 1 ? {
floor: function (date) {
while (skipped(date = interval.floor(date)))
date = d3_time_scaleDate(date - 1);
return date;
},
ceil: function (date) {
while (skipped(date = interval.ceil(date)))
date = d3_time_scaleDate(+date + 1);
return date;
}
} : interval));
};
scale.ticks = function (interval, skip) {
var extent = d3_scaleExtent(scale.domain()), method = interval == null ? tickMethod(extent, 10) : typeof interval === 'number' ? tickMethod(extent, interval) : !interval.range && [
{ range: interval },
skip
];
if (method)
interval = method[0], skip = method[1];
return interval.range(extent[0], d3_time_scaleDate(+extent[1] + 1), skip < 1 ? 1 : skip);
};
scale.tickFormat = function () {
return format;
};
scale.copy = function () {
return d3_time_scale(linear.copy(), methods, format);
};
return d3_scale_linearRebind(scale, linear);
}
function d3_time_scaleDate(t) {
return new Date(t);
}
var d3_time_scaleSteps = [
1000,
5000,
15000,
30000,
60000,
300000,
900000,
1800000,
3600000,
10800000,
21600000,
43200000,
86400000,
172800000,
604800000,
2592000000,
7776000000,
31536000000
];
var d3_time_scaleLocalMethods = [
[
d3_time.second,
1
],
[
d3_time.second,
5
],
[
d3_time.second,
15
],
[
d3_time.second,
30
],
[
d3_time.minute,
1
],
[
d3_time.minute,
5
],
[
d3_time.minute,
15
],
[
d3_time.minute,
30
],
[
d3_time.hour,
1
],
[
d3_time.hour,
3
],
[
d3_time.hour,
6
],
[
d3_time.hour,
12
],
[
d3_time.day,
1
],
[
d3_time.day,
2
],
[
d3_time.week,
1
],
[
d3_time.month,
1
],
[
d3_time.month,
3
],
[
d3_time.year,
1
]
];
var d3_time_scaleLocalFormat = d3_time_format.multi([
[
'.%L',
function (d) {
return d.getMilliseconds();
}
],
[
':%S',
function (d) {
return d.getSeconds();
}
],
[
'%I:%M',
function (d) {
return d.getMinutes();
}
],
[
'%I %p',
function (d) {
return d.getHours();
}
],
[
'%a %d',
function (d) {
return d.getDay() && d.getDate() != 1;
}
],
[
'%b %d',
function (d) {
return d.getDate() != 1;
}
],
[
'%B',
function (d) {
return d.getMonth();
}
],
[
'%Y',
d3_true
]
]);
var d3_time_scaleMilliseconds = {
range: function (start, stop, step) {
return d3.range(Math.ceil(start / step) * step, +stop, step).map(d3_time_scaleDate);
},
floor: d3_identity,
ceil: d3_identity
};
d3_time_scaleLocalMethods.year = d3_time.year;
d3_time.scale = function () {
return d3_time_scale(d3.scale.linear(), d3_time_scaleLocalMethods, d3_time_scaleLocalFormat);
};
var d3_time_scaleUtcMethods = d3_time_scaleLocalMethods.map(function (m) {
return [
m[0].utc,
m[1]
];
});
var d3_time_scaleUtcFormat = d3_time_formatUtc.multi([
[
'.%L',
function (d) {
return d.getUTCMilliseconds();
}
],
[
':%S',
function (d) {
return d.getUTCSeconds();
}
],
[
'%I:%M',
function (d) {
return d.getUTCMinutes();
}
],
[
'%I %p',
function (d) {
return d.getUTCHours();
}
],
[
'%a %d',
function (d) {
return d.getUTCDay() && d.getUTCDate() != 1;
}
],
[
'%b %d',
function (d) {
return d.getUTCDate() != 1;
}
],
[
'%B',
function (d) {
return d.getUTCMonth();
}
],
[
'%Y',
d3_true
]
]);
d3_time_scaleUtcMethods.year = d3_time.year.utc;
d3_time.scale.utc = function () {
return d3_time_scale(d3.scale.linear(), d3_time_scaleUtcMethods, d3_time_scaleUtcFormat);
};
d3.text = d3_xhrType(function (request) {
return request.responseText;
});
d3.json = function (url, callback) {
return d3_xhr(url, 'application/json', d3_json, callback);
};
function d3_json(request) {
return JSON.parse(request.responseText);
}
d3.html = function (url, callback) {
return d3_xhr(url, 'text/html', d3_html, callback);
};
function d3_html(request) {
var range = d3_document.createRange();
range.selectNode(d3_document.body);
return range.createContextualFragment(request.responseText);
}
d3.xml = d3_xhrType(function (request) {
return request.responseXML;
});
if (typeof define === 'function' && define.amd)
this.d3 = d3, define(d3);
else if (typeof module === 'object' && module.exports)
module.exports = d3;
else
this.d3 = d3;
}();
Polymer({
is: 'px-simple-horizontal-bar-chart',
behaviors: [pxSimpleChartCommonBehavior],
_defaultColors: [
'#5da5da',
'#faa43a',
'#60bd68',
'#f17cb0',
'#b2912f',
'#b276b2',
'#decf3f',
'#f15854',
'#4d4d4d'
],
_defaultChartData: [
29,
20,
15,
18,
8,
10
],
_defaultChartLabels: [
'Bar One',
'Bar Two',
'Bar Three',
'Bar Four',
'Bar Five',
'Bar Six',
'Bar Seven',
'Bar Eight',
'Bar Nine',
'Bar Ten',
'Bar Eleven',
'Bar Twelve',
'Bar Thirteen',
'Bar Fourteen',
'Bar Fifteen'
],
_defaultMeasurements: {
_legendBoxSize: 12,
_legendMargin: 5,
_legendTextWidth: 115,
_legendPadding: 19,
_legendMarginTop: 8,
_barPadding: 2,
_minimumBarHeight: 10
},
properties: {
chartData: {
type: Array,
observer: '_drawChart',
value: function () {
return this._defaultChartData;
}
},
legendLabels: {
type: Array,
observer: '_drawChart',
value: function () {
return this._defaultChartLabels;
}
},
colors: {
type: Array,
observer: '_drawChart',
value: function () {
return this._defaultColors;
}
},
barLabels: {
type: String,
observer: '_drawChart',
value: 'percentage'
},
domainMin: {
type: Number,
observer: '_drawChart',
value: 0
},
domainMax: {
type: Number,
observer: '_drawChart'
}
},
_setDefaultMeasurements: function () {
for (var prop in this._defaultMeasurements) {
this[prop] = this._defaultMeasurements[prop];
}
;
this._legendColumnWidth = this._legendBoxSize + this._legendMargin + this._legendTextWidth;
this._legendItemHeight = this._legendMargin + this._legendBoxSize;
},
_drawChartDebounced: function () {
if (this.chartData && this.chartData.length > 0 && this.svg) {
this._setDefaultMeasurements();
this._clearSVG(this.svg);
this._setDimensions();
var drawLegend = this._isThereEnoughSpaceForLegend();
this._setSizes(drawLegend);
this._drawSVG();
this._setScales();
this._drawBars();
this._drawLeftLine();
if (drawLegend) {
this._drawLegend();
}
this._addStyleScope(this.svg);
} else {
var that = this;
var timeout = setTimeout(function () {
that._drawChartDebounced();
}, 100);
}
},
_setSizes: function (drawLegend) {
this.chartWidth = this.widthValue - this._getBarLabelWidth();
var availableHeight = drawLegend ? this.heightValue - this._getLegendHeight() : this.heightValue;
this.barHeight = Math.round(availableHeight / this.chartData.length) - this._barPadding;
if (this.barHeight < this._minimumBarHeight) {
console.error('The bar height is too low. In order to improve rendering of the chart, increase the height of the chart or remove data points being charted.');
} else if (this.barHeight < 1) {
console.error('The height of your chart is too low to render the component.');
}
;
this.chartHeight = (this.barHeight + this._barPadding) * this.chartData.length - this._barPadding;
},
_getBarLabelWidth: function () {
return 60;
},
_drawSVG: function () {
this.svg.attr('width', this.widthValue).attr('height', this.heightValue);
},
_setScales: function () {
if (this.domainMax) {
if (this.domainMax < d3.max(this.chartData)) {
console.error('domainMax input is less than the Max Chart Data');
this.xScale = d3.scale.linear().domain([
0,
d3.max(this.chartData)
]).range([
0,
this.chartWidth
]);
} else {
this.xScale = d3.scale.linear().domain([
this.domainMin,
this.domainMax
]).range([
0,
this.chartWidth
]);
}
;
} else {
this.xScale = d3.scale.linear().domain([
0,
d3.max(this.chartData)
]).range([
0,
this.chartWidth
]);
}
;
},
_getColor: function (index) {
if (index >= 0 && index < this.colors.length) {
return this.colors[index];
} else {
return this._getColor(Math.abs(this.colors.length - index));
}
;
},
_getMaxNumberOfColumns: function () {
return Math.floor(this.widthValue / this._legendColumnWidth);
},
_getMaxLegendColumns: function () {
var maxColumns = this._getMaxNumberOfColumns();
if (this.chartData.length / maxColumns >= 1) {
return Math.floor(maxColumns);
} else {
var columnsUsed = Math.floor(this.chartData.length % maxColumns);
if (columnsUsed === 0) {
return maxColumns;
} else {
return columnsUsed;
}
}
;
},
_getMaxItemsInColumn: function () {
return Math.ceil(this.chartData.length / this._getMaxLegendColumns());
},
_getLegendHeight: function () {
return this._getMaxItemsInColumn() * this._legendItemHeight + this._legendMarginTop;
},
_drawLegendBox: function (x, y, color) {
var boxNode = this.svg.append('rect').attr('class', 'legend-box').attr('x', x).attr('y', y).attr('width', this._legendBoxSize).attr('height', this._legendBoxSize).attr('fill', color);
this._addStyleScopeToElement(boxNode);
return boxNode;
},
_drawLegendLabel: function (x, y, labelText) {
var textNode = this.svg.append('text').attr('class', 'legend-text').attr('x', x + 10).attr('y', y + 10).text(labelText);
this._addStyleScopeToElement(textNode);
return textNode;
},
_drawLegendItem: function (i) {
var labelText = this.legendLabels[i];
var color = this._getColor(i);
var maxItemsInColumn = this._getMaxItemsInColumn();
var targetWidth = this._legendTextWidth;
var columnNumber = Math.floor(i / maxItemsInColumn);
var x = columnNumber * this._legendColumnWidth;
var columnTop = this._legendItemHeight * maxItemsInColumn * columnNumber;
var y = i * this._legendItemHeight + this.chartHeight - columnTop + this._legendMarginTop;
if (typeof y !== Number) {
}
var that = this;
var labelTextPromise = this._shortenText(labelText, targetWidth);
labelTextPromise.then(function (labelText) {
that._drawLegendBox(x, y, color);
that._drawLegendLabel(x + that._legendMargin, y, labelText);
}).catch(function (reason) {
console.log('labelTextPromise rejected:', reason);
});
},
_shortenText: function (text, targetWidth) {
var that = this;
return new Promise(function (resolve, reject) {
var widthPromise = that._calculateTextWidth(text, 'legend-text');
widthPromise.then(function (width) {
if (width <= targetWidth) {
resolve(text);
} else {
var newText = text.substring(0, text.length - 4) + '...';
var shortenPromise = that._shortenText(newText, targetWidth);
shortenPromise.then(function (promiseText) {
resolve(promiseText);
}).catch(function (reason) {
console.log('shortenPromise failed. Reason: ', reason);
});
}
}).catch(function (reason) {
console.log('widthPromise failed. Reason: ', reason);
});
});
},
_getNumberOfColumnsUsed: function () {
return Math.ceil(this.chartData.length / this._getMaxItemsInColumn());
},
_getWidthUsedByLegend: function () {
return this._legendColumnWidth * this._getNumberOfColumnsUsed();
},
_drawLegend: function () {
var dataLength = this.chartData.length;
var i;
if (this.legendLabels.length < this.chartData.length) {
console.error('There are not enough legend-labels defined for the chart data.');
}
;
var diff = this.widthValue - this._getWidthUsedByLegend();
this._legendTextWidth += Math.floor(diff / this._getNumberOfColumnsUsed()) - this._legendMargin;
this._legendColumnWidth = this._legendBoxSize + this._legendMargin + this._legendTextWidth;
for (i = 0; i < dataLength; i++) {
this._drawLegendItem(i);
}
;
},
_drawBar: function (x, y, width, height, i, color) {
this.svg.append('rect').attr('class', 'bar').attr('x', x).attr('y', y).attr('width', width).attr('height', height).attr('fill', i);
},
_calculateLabelCenterOffset: function (rectObject) {
var height = rectObject.height;
var diff = Math.abs(this.barHeight - height);
var offset = diff / 2 - this._barPadding + height;
return Math.round(offset - offset * 0.1);
},
_drawBarLabel: function (x, y, labelText) {
var textSizePromise = this._calculateTextSize(labelText);
var widthValue = this.widthValue;
var that = this;
textSizePromise.then(function (rectObject) {
var textWidth = rectObject.width;
var labelOffset = that._calculateLabelCenterOffset(rectObject);
var textNode = that.svg.append('text').attr('class', 'bar-label').attr('x', widthValue - textWidth - 10).attr('y', y + labelOffset).attr('width', textWidth).text(labelText);
that._addStyleScopeToElement(textNode);
}).catch(function (reason) {
console.log('textSizePromise rejected: ', reason);
});
},
_sum: function (arr) {
return arr.reduce(function (previousValue, currentValue) {
return previousValue + currentValue;
});
},
_getPercent: function (value, sum) {
return Math.round(value / sum * 100);
},
_getPercentAccurate: function (value, sum) {
return Math.round(value / sum * 100 * 10) / 10;
},
_percentagesNeedFloatingPoint: function (arr) {
var sum = this._sum(arr);
var i = 0, len = arr.length, percentageSum = 0;
for (i = 0; i < len; i++) {
percentageSum += this._getPercent(arr[i], sum);
}
;
return percentageSum !== 100;
},
_drawBars: function () {
var length = this.chartData.length, i = 0, value, labelText, barWidth, y, x, color;
var sum = this._sum(this.chartData);
var drawBars = this._isThereEnoughSpaceForBarLabels();
var percentFunction = this._percentagesNeedFloatingPoint(this.chartData) ? this._getPercentAccurate : this._getPercent;
for (i; i < length; i++) {
value = this.chartData[i];
if (value == 0) {
textLabel = value + '%';
} else {
textLabel = percentFunction(value, sum) + '%';
}
;
barWidth = Math.floor(this.xScale(value));
x = 0;
y = i * (this.barHeight + this._barPadding);
color = this._getColor(i);
this._drawBar(x, y, barWidth, this.barHeight, color);
if (drawBars) {
this._drawBarLabel(x, y, textLabel);
}
}
;
},
_drawLeftLine: function () {
this.svg.append('line').attr('class', 'bar-chart-left-line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', this.chartHeight);
},
_minChartHeight: function (minBarHeight) {
return minBarHeight * this.chartData.length + this._legendMarginTop + this._legendItemHeight * this._getMaxItemsInColumn();
},
_isThereEnoughSpaceForBarLabels: function () {
return this._minChartHeight(14) <= this.heightValue;
},
_isThereEnoughSpaceForLegend: function () {
return this._minChartHeight(3) <= this.heightValue;
}
});
Polymer({
is: 'iron-pages',
behaviors: [
Polymer.IronResizableBehavior,
Polymer.IronSelectableBehavior
],
properties: {
activateEvent: {
type: String,
value: null
}
},
observers: ['_selectedPageChanged(selected)'],
_selectedPageChanged: function (selected, old) {
this.async(this.notifyResize);
}
});
console.warn('elements.html loaded');
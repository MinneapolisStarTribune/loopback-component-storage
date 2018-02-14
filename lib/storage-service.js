// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-component-storage
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0
'use strict';

var factory = require('./factory');
var handler = require('./storage-handler');

var storage = require('pkgcloud').storage;
var debug = require('debug')('loopback:storage:service');

module.exports = StorageService;

/**
 * Storage service constructor.  Properties of options object depend on the storage service provider.
 *
 * @options {Object} options Options to create a provider; see below.
 * @prop {String} provider Storage service provider. Must be one of:
 * <ul><li>'filesystem' - local file system.</li>
 * <li>'amazon'</li>
 * <li>'rackspace'</li>
 * <li>'azure'</li>
 * <li>'openstack'</li>
 * </ul>
 *
 * Other supported values depend on the provider.
 * See the [documentation](https://docs.strongloop.com/display/LB/Storage+component) for more information.
 * @class
 */
function StorageService(options) {
  if (!(this instanceof StorageService)) {
    return new StorageService(options);
  }
  this.provider = options.provider;
  this.client = factory.createClient(options);
  this.handler = handler;

  if ('function' === typeof options.getFilename) {
    this.getFilename = options.getFilename;
  }
  if ('function' === typeof options.setFolder) {
    this.handler.setFolder = options.setFolder;
  }
  if ('function' === typeof options.getFolder) {
    this.handler.getFolder = options.getFolder;
  }
  if (options.acl) {
    this.acl = options.acl;
  }
  if (options.allowedContentTypes) {
    this.allowedContentTypes = options.allowedContentTypes;
  }
  if (options.maxFileSize) {
    this.maxFileSize = options.maxFileSize;
  }
  if (options.nameConflict) {
    this.nameConflict = options.nameConflict;
  }
  if (options.maxFieldsSize) {
    this.maxFieldsSize = options.maxFieldsSize;
  }
}

function map(obj) {
  return obj;
}

/**
 * List all storage service containers.
 * @callback {Function} callback Callback function
 * @param {Object|String} err Error string or object
 * @param {Object[]} containers An array of container metadata objects
 */
StorageService.prototype.getContainers = function(cb) {
  this.client.getContainers(function(err, containers) {
    if (err) {
      cb(err, containers);
    } else {
      cb(err, containers.map(function(c) {
        return map(c);
      }));
    }
  });
};

/**
 * Create a new storage service container.
 *
 * @options {Object} options Options to create a container. Option properties depend on the provider.
 * @prop {String} name Container name
 * @callback {Function} cb Callback function
 * @param {Object|String} err Error string or object
 * @param {Object} container Container metadata object
 */

StorageService.prototype.createContainer = function(options, cb) {
  options = options || {};
  if ('object' === typeof options && !(options instanceof storage.Container)) {
    options.Name = options.name; // Amazon expects Name
    var Container = factory.getProvider(this.provider).storage.Container;
    options = new Container(this.client, options);
  }
  debug('Creating container with options %o', options);
  return this.client.createContainer(options, function(err, container) {
    return cb(err, map(container));
  });
};

/**
 * Destroy an existing storage service container.
 * @param {String} container Container name.
 * @param {String} folder
 * @callback {Function} callback Callback function.
 */
StorageService.prototype.destroyContainer = function(container, cb) {
  return this.client.destroyContainer(container, cb);
};

/**
 * Look up a container metadata object by name.
 * @param {String} container Container name.
 * @callback {Function} callback Callback function.
 * @param {Object|String} err Error string or object
 * @param {Object} container Container metadata object
 */
StorageService.prototype.getContainer = function(container, cb) {
  return this.client.getContainer(container, function(err, container) {
    if (err && err.code === 'ENOENT') {
      err.statusCode = err.status = 404;
      return cb(err);
    }
    return cb(err, map(container));
  });
};

/**
 * Get the stream for uploading
 * @param {String} container Container name
 * @param {String} file  File name
 * @param {String} folder  File name
 * @options {Object} [options] Options for uploading
 * @callback callback Callback function
 * @param {String|Object} err Error string or object
 * @returns {Stream} Stream for uploading
 */
StorageService.prototype.uploadStream = function(container, file, options) {
  if (typeof options === 'function') {
    options = {};
  }
  options = options || {};
  if (container) {
    options.container = container;
  }
  if (file) {
    options.remote = file;
  }
  debug('Obtaining upload stream for file %s and options %o', file, options);
  return this.handler.uploadStream(this.client, container, file, this.folder, options);
};

/**
 * Get the stream for downloading.
 * @param {String} container Container name.
 * @param {String} file File name.
 * @param {String} folder File name.
 * @options {Object} options Options for downloading
 * @callback {Function} callback Callback function
 * @param {String|Object} err Error string or object
 * @returns {Stream} Stream for downloading
 */
StorageService.prototype.downloadStream = function(container, file, options) {
  if (typeof options === 'function') {
    options = {};
  }
  options = options || {};
  if (container) {
    options.container = container;
  }
  if (file) {
    options.remote = file;
  }
  debug('Obtaining download stream for file %s and options %o', file, options);
  return this.handler.downloadStream(this.client, container, file, this.folder, options);
};

/**
 * List all files within the given container.
 * @param {String} container Container name.
 * @param {String} folder Container name.
 * @param {Object} [options] Options for download
 * @callback {Function} cb Callback function
 * @param {Object|String} err Error string or object
 * @param {Object[]} files An array of file metadata objects
 */
StorageService.prototype.getFiles = function(container, options, cb) {
  return this.handler.getFiles(this.client, container, this.folder, options, cb);
};

/**
 * Look up the metadata object for a file by name
 * @param {String} container Container name
 * @param {String} file File name
 * @param {String} folder File name
 * @callback {Function} cb Callback function
 * @param {Object|String} err Error string or object
 * @param {Object} file File metadata object
 */
StorageService.prototype.getFile = function(container, file, cb) {
  return this.handler.getFile(this.client, container, file, this.folder, cb);
};

/**
 * Remove an existing file
 * @param {String} container Container name
 * @param {String} file File name
 * @param {String} folder File name
 * @callback {Function} cb Callback function
 * @param {Object|String} err Error string or object
 */
StorageService.prototype.removeFile = function(container, file, cb) {
  return this.handler.removeFile(this.client, container, file, this.folder, cb);
};

/**
 * Upload middleware for the HTTP request/response  <!-- Should this be documented? -->
 * @param {String} [container] Container name
 * @param {Request} req Request object
 * @param {Response} res Response object
 * @param {Object} [options] Options for upload
 * @param {Function} cb Callback function
 */
StorageService.prototype.upload = function(container, req, res, options, cb) {
  debug('Configuring upload with options %o', options);
  // Test if container is req for backward compatibility
  if (typeof container === 'object' && container.url && container.method) {
    // First argument is req, shift all args
    cb = options;
    options = res;
    res = req;
    req = container;
  }
  if (!cb && 'function' === typeof options) {
    cb = options;
    options = {};
  }
  options.folder = this.folder;

  if (this.getFilename && !options.getFilename) {
    options.getFilename = this.getFilename;
  }
  if (this.acl && !options.acl) {
    options.acl = this.acl;
  }
  if (this.allowedContentTypes && !options.allowedContentTypes) {
    options.allowedContentTypes = this.allowedContentTypes;
  }
  if (this.maxFileSize && !options.maxFileSize) {
    options.maxFileSize = this.maxFileSize;
  }
  if (this.nameConflict && !options.nameConflict) {
    options.nameConflict = this.nameConflict;
  }
  if (this.maxFieldsSize && !options.maxFieldsSize) {
    options.maxFieldsSize = this.maxFieldsSize;
  }
  if (typeof container === 'string') {
    options.container = container;
  }
  debug('Upload configured with options %o', options);
  return this.handler.upload(this.client, req, res, options, cb);
};

/**
 * Download middleware
 * @param {String} container Container name
 * @param {String} file File name
 * @param {Request} req HTTP request
 * @param {Response} res HTTP response
 * @param {Function} cb Callback function
 */
StorageService.prototype.download = function(container, file, req, res, cb) {
  return this.handler.download(this.client, req, res, container, file, this.folder, cb);
};

StorageService.modelName = 'storage';

StorageService.prototype.getContainers.shared = true;
StorageService.prototype.getContainers.accepts = [];
StorageService.prototype.getContainers.returns = {
  arg: 'containers',
  type: 'array',
  root: true,
};
StorageService.prototype.getContainers.http =
{verb: 'get', path: '/'};

StorageService.prototype.getContainer.shared = true;
StorageService.prototype.getContainer.accepts = [
  {arg: 'container', type: 'string', required: true, 'http': {source: 'path'}},
];
StorageService.prototype.getContainer.returns =
{arg: 'container', type: 'object', root: true};
StorageService.prototype.getContainer.http =
{verb: 'get', path: '/:container'};

StorageService.prototype.createContainer.shared = true;
StorageService.prototype.createContainer.accepts = [
  {arg: 'options', type: 'object', http: {source: 'body'}},
];
StorageService.prototype.createContainer.returns = {
  arg: 'container',
  type: 'object', root: true,
};
StorageService.prototype.createContainer.http =
{verb: 'post', path: '/'};

StorageService.prototype.destroyContainer.shared = true;
StorageService.prototype.destroyContainer.accepts = [
  {arg: 'container', type: 'string', required: true, 'http': {source: 'path'}},
];
StorageService.prototype.destroyContainer.returns = {};
StorageService.prototype.destroyContainer.http =
{verb: 'delete', path: '/:container'};

StorageService.prototype.getFiles.shared = true;
StorageService.prototype.getFiles.accepts = [
  {arg: 'container', type: 'string', required: true, 'http': {source: 'path'}},
];
StorageService.prototype.getFiles.returns = {arg: 'files', type: 'array', root: true};
StorageService.prototype.getFiles.http =
{verb: 'get', path: '/:container/files'};

StorageService.prototype.getFile.shared = true;
StorageService.prototype.getFile.accepts = [
  {arg: 'container', type: 'string', required: true, 'http': {source: 'path'}},
  {arg: 'file', type: 'string', required: true, 'http': {source: 'path'}},
];
StorageService.prototype.getFile.returns = {arg: 'file', type: 'object', root: true};
StorageService.prototype.getFile.http =
{verb: 'get', path: '/:container/files/:file'};

StorageService.prototype.removeFile.shared = true;
StorageService.prototype.removeFile.accepts = [
  {arg: 'container', type: 'string', required: true, 'http': {source: 'path'}},
  {arg: 'file', type: 'string', required: true, 'http': {source: 'path'}},
];
StorageService.prototype.removeFile.returns = {};
StorageService.prototype.removeFile.http =
{verb: 'delete', path: '/:container/files/:file'};

StorageService.prototype.upload.shared = true;
StorageService.prototype.upload.accepts = [
  {arg: 'container', type: 'string', required: true, 'http': {source: 'path'}},
  {arg: 'req', type: 'object', 'http': {source: 'req'}},
  {arg: 'res', type: 'object', 'http': {source: 'res'}},
];
StorageService.prototype.upload.returns = {arg: 'result', type: 'object'};
StorageService.prototype.upload.http =
{verb: 'post', path: '/:container/upload'};

StorageService.prototype.download.shared = true;
StorageService.prototype.download.accepts = [
  {arg: 'container', type: 'string', required: true, 'http': {source: 'path'}},
  {arg: 'file', type: 'string', required: true, 'http': {source: 'path'}},
  {arg: 'req', type: 'object', 'http': {source: 'req'}},
  {arg: 'res', type: 'object', 'http': {source: 'res'}},
];
StorageService.prototype.download.http =
{verb: 'get', path: '/:container/download/:file'};

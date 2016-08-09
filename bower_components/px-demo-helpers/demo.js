document.addEventListener('WebComponentsReady', function () {
    var template = window.template = document.getElementById('editorTmpl');
    var selectedTemplateId = null;
    var selectedTemplate = null;
    var codeEditor = document.getElementById('codeEditor');

    document.getElementById('templateCollection').fetch();

    template.getDb = function () {
        return document.getElementById('templateCollection').db;
    };

    var db = template.getDb();
    var takeScreenshot = window.takeScreenshot = function (id, cb) {
        var captureElement = document.getElementById(id);
        var captureUrl = '';
        html2canvas(captureElement, {
            allowTaint: false,
            background: '#ffffff',
            logging: true,
            letterRendering: false,
            timeout: 1500,
            //useCORS: true,
            onrendered: function (canvas) {
                captureUrl = canvas.toDataURL();
                cb(canvas);
            }
        });
    };

    function showAlert(type, msg) {
        var _alert = '<div class="alert ' + type + '">' + msg + '</div>';
        console.warn(type, msg);
        document.getElementById('alerts').html(_alert);
        setTimeout(function () {
            document.getElementById('alerts').html(' ');
        }, 2500);
    }

    template.saveTemplateAsAttachment = function (doc) {
        var aFileParts = [editor.getValue()];
        var myBlob = new Blob(aFileParts, {
            type: 'text/html'
        });
        return template.getDb().get(doc._id).then(function (resp) {
            doc._rev = resp.data._rev;
            console.log('got document', resp);

            return template.getDb().saveAttachment(resp.data._id, resp.data._rev, resp.data._id + '.html',
                myBlob.type, myBlob).then(function (res) {
                console.log('save attachment response', res);
                showAlert('success', res.id + ' was saved!');
            });
        });

    };

    function upsert(doc) {
        console.warn('Upsert', doc);
        return db.get(doc._id).then(function (resp) {
            doc._rev = resp.data._rev;
            return db.put(doc).then(function (res) {
                console.log('saved', res);
                showAlert('success', res.data.id + ' was updated to ' + res.data.rev);
                return res;
            });
        }).catch(function (err) {
            console.log('Not found so creating', err);
            return db.put(doc).then(function (res) {
                console.log('created', res);
                showAlert('success', res.data.id + ' was updated to ' + res.data.rev);
                return res;
            });
        });
    }

    function refreshTemplates() {
        document.getElementById('templateCollection').fetch();
    }

    function scrollToTop() {
        window.scrollTo(0, 0);
    }

    template.refreshTemplates = refreshTemplates;

    template.deleteTemplate = function () {
        var id = codeEditor.selectedFile.doc._id;
        var rev = codeEditor.selectedFile.doc._rev;
        document.getElementById('templateCollection').db.remove(id, rev).then(function () {
            refreshTemplates();
        });

        console.warn('remove', id, rev);
    };

    template.toggleDevice = function () {
        codeEditor.device = !codeEditor.device;
        document.getElementById('myDevice').toggleDevice();
        console.warn('toggle device');
    };

    template.takeScreenshot = function () {
        var item, img = document.createElement('img');
        var doc = codeEditor.selectedFile.doc;
        return new Promise(function (resolve, reject) {
            takeScreenshot('output', function (canvas) {
                console.log('Screenshot result', canvas);
                codeEditor.selectedFile.doc.screenshot = canvas.toDataURL();
                if (canvas.toBlob) {
                    canvas.toBlob(function (blob) {
                        console.log(blob);
                        db.get(doc._id).then(function (resp) {
                            db.saveAttachment(resp.data._id, resp.data._rev,
                                resp.data._id + '.jpeg',
                                blob.type,
                                blob).then(function (res) {
                                //	showAlert('info', 'Saved ')
                                console.log('selectedTemplate', selectedTemplate);
                                refreshTemplates();
                                resolve(res);
                            });
                        });
                    }, 'image/jpeg');
                }

                //codeEditor.selectedFile.doc.screenshot = '';

                /*
                 db.get(codeEditor.selectedFile.doc._id).then(function(resp){
                 db.saveAttachment(resp.data._id, resp.data._rev, 'screenshot.png', 'image/png', id).then(function(res){
                 console.log(res);
                 console.log('selectedTemplate', selectedTemplate);
                 document.getElementById('screenshots').append(item);
                 resolve(res);
                 });
                 });
                 */
                //codeEditor.selectedFile.doc['_attachments'] = '';

            });
        });
    };

    template.getSelectedTemplate = function () {
        return codeEditor.selectedFile.doc;
    };
    template.getSelectedTemplateId = function () {
        return codeEditor.selectedFile.doc._id;
    };

    template.newTemplate = function (e) {
        var promptUser = prompt('Enter the _id');

        console.log('new', promptUser);
        upsert({
            _id: promptUser
        }).then(function (resp) {
            console.warn('resp', resp);
            refreshTemplates();
            //template.selectedTemplateId = promptUser;
            //codeEditor.$._editor.value = promptUser;
        });

    };

    template.resetTemplate = function (e) {
        console.log('reset', e);
        template.selectedTemplateId = 'template-' + pxMobile.utils.uuid();
        codeEditor.$._editor.value = '';
    };

    // TODO: Handle selecting a template
    template.selectTemplate = function (e) {
        console.log('selectTemplate', e.model.item);
        template.selectedTemplateId = e.model.item.id;
        codeEditor.selectTemplate(e);
        //scrollToTop();

        db.get(template.selectedTemplateId + '/' + e.model.item.id + '.html').then(
            function (resp) {
                console.warn('INFO', 'loaded template from database', resp);
                //selectedTemplate = resp.data;

                codeEditor.$._editor.value = resp.data;
                codeEditor.code = resp.data;

            });
    };

    template.saveTemplate = function (e) {
        e.preventDefault();
        var doc = template.getSelectedTemplate();
        doc._id = template.getSelectedTemplateId();
        //delete doc.screenshot;
        doc.data = editor.getValue();

        console.log('save Template', doc);
        upsert(doc).then(function (res) {
            console.log('saved', res);
        });

        return false;
    };


		window.cleanTemplates = function(){
			db.allDocs({
				include_docs: true,
				startkey: 'template-a',
				endkey: 'template-z'
			}).then(function(resp){
				console.log('Cleaning', resp.data);
				resp.data.rows.forEach(function(row){
					console.log('Cleaning', row.id);
					delete row.doc._attachments;
					delete row.doc.screenshot;
					db.put(row.doc).then(function (res) {
	            console.warn('Cleaned', res);
	        });
				});
			});
		};
});

function showCode() {
  document.querySelectorAll('.code-container').forEach(function (el) {
    el.style.display = 'block';
  });
}

function hideCode() {
  document.querySelectorAll('.code-container').forEach(function (el) {
    el.style.display = 'none';
  });
}

function createToc(id) {
  var toc = document.getElementById(id);
  var headings = document.querySelectorAll('h2'),
    heading, link, li;
  for (var i = 0; i < headings.length; i++) {
    heading = headings[i].textContent;
    headings[i].id = headings[i].textContent.replace(/\W/g, '-');
    li = document.createElement('li');
    link = document.createElement('a');
    link.href = '#' + headings[i].id;
    link.textContent = heading;
    li.appendChild(link);
    toc.appendChild(li);
    console.log('Adding id to heading', headings[i]);
  }
}

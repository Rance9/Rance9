
(function(){
  var shots=[].slice.call(document.querySelectorAll('a.tv')),dlg=document.getElementById('big'),img=document.getElementById('big-img'),at=0;
  if(!dlg||!dlg.showModal)return;
  function show(i){at=(i+shots.length)%shots.length;var a=shots[at];img.src=a.getAttribute('href');img.alt=a.querySelector('img').alt;}
  shots.forEach(function(a,i){a.addEventListener('click',function(e){e.preventDefault();show(i);dlg.showModal();});});
  document.getElementById('big-prev').addEventListener('click',function(){show(at-1);});
  document.getElementById('big-next').addEventListener('click',function(){show(at+1);});
  dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close();});
  dlg.addEventListener('keydown',function(e){if(e.key==='ArrowLeft')show(at-1);if(e.key==='ArrowRight')show(at+1);});
})();

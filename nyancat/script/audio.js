
function loop () {


checkBox = document.getElementById('play');
if(checkBox.checked) {

   

    audio.play();
}

else{
    audio.pause();
}

}

loop();
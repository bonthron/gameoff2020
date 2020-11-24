

function Boat(){
    
    cjs.Ticker.framerate = 60;
    cjs.Ticker.timingMode = cjs.Ticker.RAF;

    var stage = new cjs.Stage("canvas1");
    cjs.Ticker.addEventListener('tick', stage);
    
    var queue = new createjs.LoadQueue(true);
    queue.on("complete", function(){ init(); });    
    queue.on("error", function(e){ console.log(e); });    
    queue.loadManifest([
        {id:"water", src:"images/water.png"},
        {id:"boat", src:"images/boat.png"},
        {id:"island", src:"images/island.png"}        
    ]);

    function init(){
        waterBG.image = queue.getResult("water");
        island.image  = queue.getResult("island");
        island2.image = queue.getResult("island");        
        boatBMP.image = queue.getResult("boat");
    }
    
    var water = new cjs.Container();
    water.regX = 844;
    water.x = 253;
    water.y = -2475;
    
    var waterBG = new cjs.Bitmap();

    var island = new cjs.Bitmap();
    island.x = 800;
    island.y = 2000;

    var island2 = new cjs.Bitmap();
    island2.x = 600;
    island2.y = 1000;
    
    water.addChild(waterBG);
    water.addChild(island);
    water.addChild(island2);    

    stage.addChild(water);

    var boat = new cjs.Container()
    boat.regX = 11;
    boat.regY = 40;            
    boat.x = 300;
    boat.y = 400;

    var boatBMP = new cjs.Bitmap();
    var wake = new cjs.Container()
    
    boat.addChild(boatBMP);        
    boat.addChild(wake);        
    
    stage.addChild(boat);


    // ------------------------------------------------------------------------ UI streams

    var wheelPos = Array.from(document.querySelectorAll('input[type=radio][name=wheelPos]'));
    var dir = Bacon.fromArray(wheelPos)
        .flatMap(function(el){
            return Bacon.fromEvent(el, "change", function(e){ return e.target.id.slice(-1)})
        })
        .startWith("C")

    var speedBtns = Array.from(document.querySelectorAll('input[type=radio][name=speed]'));
    var speed = Bacon.fromArray(speedBtns)
        .flatMap(function(el){
            return Bacon.fromEvent(el, "change", function(e){ return Number(e.target.id.slice(-1))});
        })
        .startWith(1)
    
    var running = Bacon.fromEvent(document.getElementById("runToggle"), "change", function(e){ return e.target.checked })
        .startWith(false)
        .toProperty()

    
    // ------------------------------------------------------------------------ baconTicker
    // create a bacon stream for time, but synched to RAF

    var bus = new Bacon.Bus();
    cjs.Ticker.addEventListener('tick', function(){ bus.push(true); })
    
    var baconTicker = bus.filter(running)

    var control = Bacon.combineTemplate({
        dir: dir,
        speed: speed
    })


    // ------------------------------------------------------------------------ hitDetection
    function hitDetection(){

        var pt = island.globalToLocal(289,380);
        var pt2 = island2.globalToLocal(289,380);
        
        return island.hitTest(pt.x, pt.y) || island2.hitTest(pt2.x, pt2.y)
    } 

    
    // ------------------------------------------------------------------------ water movement

    var waterDir = dir.decode({"A": 2, "B": 1, "C": 0, "D": -1, "E": -2 }).startWith(0);
    
    var waterMovement = Bacon.combineWith(baconTicker, control, waterDir, function(tick, ctrl, waterDir){
        return {waterDir:waterDir, boatDir:ctrl.dir, speed:ctrl.speed}
    })
        .scan({x:253, y:-2475, state:"run", tick:0}, function(acc, o){

            var state = acc.state;
            var x = acc.x;
            var y = acc.y;
            var tick = acc.tick;

            if(state == "run"){
                x = acc.x + (o.waterDir * o.speed)
                y = acc.y + o.speed;

                if(x < -139){ x = -139; }
                if(x > 757){ x = 757; }            
                if(y > 0 ){ y = 0; state = "game-over"; }

                if(hitDetection()){
                    state = "hit-tween";
                    y = y - 200; 
                    tick = 0;
                }
            }else if (state == "hit-tween"){
                if(tick > 60){
                    state = "run";
                }else{
                    tick++;
                };
            }
            
            return {x:x, y:y, state:state, tick:tick};
        })

    var runSideEffects = waterMovement
        .filter(function(o){ return o.state == "run"})
        .onValue(function(o){
            water.x = o.x;
            water.y = o.y;
        })
    
    var hitTween = waterMovement
        .filter(function(o){ return o.state == "hit-tween" && o.tick == 0})
        .onValue(function(o){
            new cjs.Tween.get(water, {useTicks:true}).to({y:o.y}, 60, cjs.Ease.circOut)
            
            new cjs.Tween.get(boat, {useTicks:true}).to({rotation:boat.rotation + 360}, 60, cjs.Ease.sineOut).call(function(){
                boat.rotation = boat.targetRotation;
            })
        })
    
    
    var gameOverHandler = waterMovement
        .filter(function(o){ return o.state == "game-over"})
        .take(1)
        .onEnd(gameOver);
    
    
    // ------------------------------------------------------------------------ boatDir

    var boatDir = dir.decode({"A": -80, "B": -45, "C": 0, "D": 45, "E": 80 })

    boatDir.onValue(function(r){
        var turnSpeed = Math.abs(boat.rotation - r) > 90 ? 600 : 400
        boat.targetRotation = r;
        cjs.Tween.get(boat).to({rotation:r}, turnSpeed);
    })


    // ------------------------------------------------------------------------ tweenWake    

    var bubble = new cjs.Shape();
    bubble.graphics.f("#fff").dc(0,0,5)
    bubble.regX = bubble.regY = 2.5;
    bubble.alpha = 0.8;
    bubble.x = 15;
    bubble.y = 88;
    bubble.cache(-1,-1,6,6);

    
    var tweenWake = Bacon.interval(200, true)
        .filter(running)
        .onValue(function(){
            
            var b = bubble.clone(false);
            wake.addChild(b)
            
            cjs.Tween.get(b)
                .to({y:120, alpha:0}, 500)
                .call(function(){
                    wake.removeChild(b)
                })
        })
    
    
    // ------------------------------------------------------------------------ gameOver
    function gameOver(){
        boat.rotation = 0;
        cjs.Tween.get(boat).to({y: -80}, 1000).call(function(){
            document.getElementById("runToggle").checked = false;
            document.getElementById("runToggle").disabled = true;
            document.querySelector('.blackBtn').style.opacity = "0.3";
            alert('game over');
        })
    }

    
}



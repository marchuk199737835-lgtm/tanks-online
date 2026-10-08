socket.on('initMusic',(data)=>{if(!data||typeof data!=='object')return;myMusicPlaylists={main:Array.isArray(data.main)?data.main:[],loby:Array.isArray(data.loby)?data.loby:[]};if(currentMusicState&&!activePlaylist.length){const st=currentMusicState;currentMusicState='';switchMusicState(st);}});
socket.on('initZombies',(data)=>{for(const k in Z_TYPES)delete Z_TYPES[k];Object.assign(Z_TYPES,data);});
// сокет створено раніше за цей файл: перші initMusic/initZombies могли прийти до підписки — перепитуємо (і після перепідключення)
socket.on('connect',()=>socket.emit('getInit'));if(socket.connected)socket.emit('getInit');
socket.on('authSuccess',(data)=>{localStorage.setItem('tankToken',data.token);if(window.I18N){if(data.lang)I18N.setLanguage(data.lang);else socket.emit('setLang',I18N.lang);}myName=data.name;myId=socket.id;if(window.authBusyOff)authBusyOff();initAudio();if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume();try{switchMusicState('main');}catch(e){console.error('music',e);}showScreen('main-menu-screen');try{if(window.soundGate)soundGate(data.name);}catch(e){console.error('gate',e);}});
socket.on('authError',(msg)=>{localStorage.removeItem('tankToken');showScreen('login-screen');if(window.authShowError)authShowError(msg);else alert(msg);});
socket.on('joinError',(msg)=>{if(window.authShowError&&!document.getElementById('login-screen').classList.contains('hidden')){authShowError(msg);return;}if(typeof upgBusy!=='undefined'&&upgBusy){upgFinish();if(typeof updateUpgChance==='function')updateUpgChance();}
    const upgVisible=!document.getElementById('upgrader-screen').classList.contains('hidden');
    if(upgVisible&&(msg.includes('апгрейд')||msg.includes('Оберіть')||msg.includes('Недостатньо')||msg.includes('Неможливо'))){
        let em=document.getElementById('upg-error-modal'),et=document.getElementById('upg-error-txt');
        if(em&&et){et.innerText=msg;em.classList.remove('hidden');if(typeof playSound==='function')playSound('hurt');return;}
    }
    if(msg.includes('Недостатньо кредів'))return uiDialog.money({price:null,have:myBucks});
    if(msg.includes('Інвентар повний'))return uiDialog.show({kind:'warn',icon:'🎒',title:'Інвентар повний',text:'Звільніть місце в інвентарі: продайте або викиньте зайві модулі.',buttons:[{t:'Закрити',cls:'ghost'},{t:'До ангару',cls:'primary',cb:()=>{if(typeof renderHangar==='function')renderHangar();showScreen('hangar-screen');}}]});
    if(msg.includes('заблокував'))return uiDialog.show({kind:'error',icon:'⛔',title:'Вхід заборонено',text:msg});
    uiDialog.show({kind:'error',title:'Не вдалося',text:msg});
});
socket.on('economyUpdate',(data)=>{myBucks=data.bucks;myInventory=data.inventory||[];myEquipped=data.equipped||{cannon:null,turret:null,hull:null,tracks:null};myStats=data.stats||{kills:0,matches:0,earned:0};myAdventClaims=data.adventClaims||[];if(window.LV)LV.setEco(data);if(typeof updateGlobalBucks==='function')updateGlobalBucks();if(typeof renderHangar==='function'&&!document.getElementById('hangar-screen').classList.contains('hidden'))renderHangar();if(typeof renderUpgrader==='function'&&!document.getElementById('upgrader-screen').classList.contains('hidden'))renderUpgrader();if(typeof renderShop==='function'&&!document.getElementById('shop-screen').classList.contains('hidden'))renderShop();if(typeof renderAdvent==='function'&&!document.getElementById('advent-modal').classList.contains('hidden'))renderAdvent();});
socket.on('promoSuccess',(msg)=>{if(typeof playSound==='function')playSound('ui_buy');uiDialog.show({kind:'success',icon:'🎁',title:'Промокод активовано',text:msg});});
socket.on('promoResult',(res)=>{if(window.Wallet)Wallet.onPromoResult(res);});
socket.on('promoError',(msg)=>{uiDialog.show({kind:'error',icon:'🎟️',title:'Промокод не підійшов',text:msg});});
socket.on('adventState',(st)=>{window.adventDay=st.day;window.adventEnd=st.end;window.adventOffset=st.now-Date.now();const m=document.getElementById('advent-modal');if(m&&!m.classList.contains('hidden')&&typeof renderAdvent==='function')renderAdvent();});
socket.on('adventSuccess',(data)=>{if(data.type==='bucks')uiDialog.show({kind:'success',icon:'🎃',title:'Нагорода адвенту',text:`Вітаємо! Нараховано +${data.amount} кредів за день ${data.day}.10.`});else uiDialog.show({kind:'success',icon:'🏆',title:'Фінальна нагорода!',text:`ВІТАЄМО! Твоя фінальна Легендарна нагорода вже в Інвентарі!`});});
let pendingDrop=null;socket.on('dropReceived',(modId)=>{pendingDrop=modId;});
socket.on('roomsList',(rooms)=>{if(typeof renderRoomsList==='function')renderRoomsList(rooms);});
socket.on('roomCreated',(roomId)=>{socket.emit('joinRoom',roomId);});
socket.on('joinedRoom',(data)=>{currentRoomId=data.roomId;currentRoomData=data.roomData;if(window.resetLobbyUI)resetLobbyUI();showScreen('lobby-screen');if(window.updateLobbyUI)updateLobbyUI();});
socket.on('updateLobby',(roomData)=>{currentRoomData=roomData;if(typeof updateLobbyUI==='function')updateLobbyUI();const gameScreen=document.getElementById('game-screen');if(roomData.status==='lobby'&&gameScreen&&!gameScreen.classList.contains('hidden')){document.getElementById('winner-modal').classList.add('hidden');if(typeof showScreen==='function')showScreen('lobby-screen');if(typeof switchMusicState==='function')switchMusicState('loby');}});
socket.on('gameStarting',(roomData)=>{if(window.resetJoysticks)resetJoysticks();for(const k in opponents)delete opponents[k];for(const k in zombies)delete zombies[k];if(typeof bullets!=='undefined')bullets.length=0;currentRoomData=roomData;const pData=currentRoomData.players[myId];myLocalTank.x=pData.x;myLocalTank.y=pData.y;myLocalTank.hp=pData.hp;camera.x=pData.x;camera.y=pData.y;myLocalTank.team=pData.team;myLocalTank.isDisguised=false;myLocalTank.propType=pData.propType;homingTargetId=null;document.getElementById('damage-vignette').style.opacity=0;spectatingId=null;pendingDrop=null;document.getElementById('drop-notification').classList.add('hidden');isBossIncoming=false;document.getElementById('survival-warning').classList.add('hidden');document.getElementById('prophunt-hud-timer')?.classList.add('hidden');document.getElementById('hunter-blind-overlay')?.classList.add('hidden');if(currentRoomData.mode==='survival'||currentRoomData.mode==='prophunt')switchMusicState('survive');else switchMusicState('dezmatch');if(typeof doCountdown==='function')doCountdown();if(currentRoomData.mode==='prophunt'&&myLocalTank.team==='hider'){setTimeout(()=>{if(typeof showPropMenu==='function')showPropMenu(15);},4000);}});

let rouletteTimers = [];
socket.on('caseResult',(result)=>{
    if(result.fromLevel&&window.LV)LV.onClaimResult();
    myBucks=result.bucks;if(result.inventory)myInventory=result.inventory;if(result.equipped)myEquipped=result.equipped;
    if(typeof updateGlobalBucks==='function')updateGlobalBucks();
    if(!MODULES[result.modId]){console.error('caseResult: невідомий модуль',result.modId);return;}

    // Якщо попередня рулетка ще крутилась - скидаємо її таймери, щоб не було накладання
    rouletteTimers.forEach(clearTimeout);rouletteTimers=[];

    const ROULETTE_LEN=65,WIN_INDEX=44;
    document.getElementById('roulette-modal').classList.remove('hidden');
    const tape=document.getElementById('roulette-tape');
    tape.style.transition='none';tape.style.transform='translateX(0px)';

    let cs=CASES[result.caseId];
    let pool=Object.keys(MODULES);
    if(cs){
        // для рулетки беремо всі модулі, що можуть випасти з цього кейса
        pool=GameData.caseTable(cs).reduce((acc,row)=>acc.concat(row.ids),[]);
    }
    if(pool.length===0) pool=Object.keys(MODULES);

    let html='';
    for(let i=0;i<ROULETTE_LEN;i++){
        const modId=(i===WIN_INDEX)?result.modId:pool[Math.floor(Math.random()*pool.length)];
        const mod=MODULES[modId],rColor=RARITY[mod.rarity].color;
        html+=`<div class="roulette-item text-center min-w-[60px] lg:min-w-[90px] w-[60px] lg:w-[90px] border-r border-slate-700 bg-slate-800" style="border-bottom: 3px solid ${rColor}"><div class="w-6 h-6 lg:w-10 lg:h-10 mx-auto">${modIcon(mod)}</div><div class="text-[6px] lg:text-[8px] text-slate-300 mt-1 lg:mt-2 uppercase truncate w-full px-1">${mod.name}</div></div>`;
    }
    tape.innerHTML=html;
    void tape.offsetWidth; // примусовий reflow: стрічка гарантовано стоїть на 0 перед стартом анімації

    rouletteTimers.push(setTimeout(()=>{
        if(!(window.UISFX&&UISFX.ready()&&UISFX.roll(tape)))playSound('shoot');
        const first=tape.firstElementChild;
        const itemWidth=first?first.offsetWidth:(window.innerWidth>1024?90:60); // реальна ширина елемента, а не припущення
        const containerWidth=tape.parentElement.offsetWidth||600;
        const targetX=(WIN_INDEX*itemWidth+itemWidth/2)-(containerWidth/2);
        tape.style.transition='transform 3.5s cubic-bezier(0.1, 1, 0.3, 1)';
        tape.style.transform=`translateX(-${targetX}px)`; // БЕЗ крапки з комою всередині значення
    },100));

    // Нагорода з'являється після того, як стрічка зупинилась (3.5с анімації + коротка пауза)
    rouletteTimers.push(setTimeout(()=>{
        if(!(window.UISFX&&UISFX.ready()&&UISFX.reveal(MODULES[result.modId].rarity)))playSound('powerup');
        document.getElementById('roulette-modal').classList.add('hidden');
        const rw=document.getElementById('reward-modal');
        if(rw){
            const mod=MODULES[result.modId];
            document.getElementById('reward-title').innerText="ТРИМАЙ!";
            document.getElementById('reward-title').className="text-3xl lg:text-4xl font-russo mb-6 tracking-widest text-emerald-400";
            document.getElementById('reward-modal-panel').style.borderColor=RARITY[mod.rarity].color;
            document.getElementById('reward-item-name').innerText=mod.name;
            document.getElementById('reward-item-icon').innerHTML=modIcon(mod);
            document.getElementById('reward-item-cat').innerText=`${CAT_NAMES[mod.type]} | ${RARITY[mod.rarity].name}`;
            document.getElementById('reward-item-cat').style.color=RARITY[mod.rarity].color;
            rw.classList.remove('hidden');
        }
    },4400));
});

socket.on('upgradeResult',(res)=>{
    myBucks=res.newBucks;myInventory=res.inv;
    if(typeof updateGlobalBucks==='function')updateGlobalBucks();
    const pointer=document.getElementById('upg-pointer'),actionBtn=document.getElementById('upg-action-btn');
    if(pointer){
        pointer.classList.remove('hidden');pointer.style.transition='none';pointer.style.left='0%';
        setTimeout(()=>{if(!(window.UISFX&&UISFX.ready()&&UISFX.upgRun(pointer)))playSound('shoot');pointer.style.transition='left 3s cubic-bezier(0.1, 1, 0.3, 1)';pointer.style.left=res.roll+'%';},50);
        setTimeout(()=>{
            pointer.classList.add('hidden');
            if(typeof upgFinish==='function')upgFinish();
            upgSrcIdx=null;upgSrcId=null;upgTgtId=null;document.getElementById('upg-slot-src').innerHTML='';document.getElementById('upg-slot-tgt').innerHTML='';
            if(typeof renderUpgrader==='function')renderUpgrader();if(typeof renderHangar==='function')renderHangar();
            if(res.win){
                if(!(window.UISFX&&UISFX.ready()&&UISFX.upgWin(MODULES[res.tId]&&MODULES[res.tId].rarity)))playSound('powerup');const rw=document.getElementById('reward-modal');
                if(rw){
                    let mod=MODULES[res.tId];
                    document.getElementById('reward-title').innerText="АПГРЕЙД УСПІШНИЙ!";
                    document.getElementById('reward-title').className="text-xl lg:text-3xl font-russo mb-6 tracking-widest text-blue-400";
                    document.getElementById('reward-modal-panel').style.borderColor=RARITY[mod.rarity].color;
                    document.getElementById('reward-item-name').innerText=mod.name;
                    document.getElementById('reward-item-icon').innerHTML=modIcon(mod);
                    document.getElementById('reward-item-cat').innerText=`${CAT_NAMES[mod.type]} | ${RARITY[mod.rarity].name}`;
                    document.getElementById('reward-item-cat').style.color=RARITY[mod.rarity].color;
                    rw.classList.remove('hidden');
                }
            }else{
                if(!(window.UISFX&&UISFX.ready()&&UISFX.upgFail()))playSound('hurt');
                let em=document.getElementById('upg-error-modal'),et=document.getElementById('upg-error-txt');
                if(em&&et){et.innerText='Апгрейд не вдався! Модуль та креди згоріли...';em.classList.remove('hidden');}
                else alert('Апгрейд не вдався!');
            }
        },3200);
    }
});

function emitDamage(amt,attacker){playSound('hurt');shakeTime=0.3;socket.emit('takeDamage',{roomId:currentRoomId,amt:amt,attacker:attacker});}
socket.on('kicked',(d)=>{currentRoomId=null;currentRoomData=null;if(window.resetLobbyUI)resetLobbyUI();const gs=document.getElementById('game-screen');showScreen('room-browser-screen');socket.emit('requestRooms');if(d&&d.banned)uiDialog.show({kind:'error',icon:'⛔',title:'Вас заблоковано',text:'Лідер заблокував вас у цій сесії. Ви не зможете зайти до неї знову.'});else if(window.uiToast)uiToast('Лідер вигнав вас із сесії',true);});

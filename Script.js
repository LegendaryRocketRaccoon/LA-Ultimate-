/* ============================================================
   FIREBASE — AUTENTICAÇÃO
   1. Vá em https://console.firebase.google.com, crie um projeto
      (ou use um existente) e adicione um "app da Web".
   2. Copie o objeto de config que o Firebase te dá e cole abaixo,
      no lugar dos valores "SEU_...".
   3. No menu lateral, vá em "Authentication" > "Sign-in method" e
      ative os provedores "E-mail/senha" e "Google".
   4. Em "Authentication" > "Users", você pode ver/gerenciar quem
      criou conta pelo botão "Criar acesso" da tela de login.
============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyC44JZRq7huUH_V7wxlIZS2vBpOG8rxZ1g",
  authDomain: "lista-de-amigos-356ca.firebaseapp.com",
  projectId: "lista-de-amigos-356ca",
  storageBucket: "lista-de-amigos-356ca.firebasestorage.app",
  messagingSenderId: "871677189816",
  appId: "1:871677189816:web:e2129cb29d8ac498cd5e4d",
  measurementId: "G-9GHD57H0CF"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
/* ============================================================
   CONTROLE DE ACESSO
   Só estes e-mails conseguem entrar. O primeiro é o admin: pode
   desbloquear/bloquear conquistas e adicionar novas. Os demais só
   visualizam. Para adicionar mais gente no futuro, é só colocar o
   e-mail nesta lista (e também nas regras do Firestore — veja o
   comentário mais abaixo, perto de ACHIEVEMENTS).
============================================================ */
const ALLOWED_EMAILS = [
  "chimellogustavo17@gmail.com",
  "olavoxavier038@gmail.com",
  "williamfurquim@hotmail.com",
  "oimperiocontraataca7@gmail.com",
  "lumimiyaki@gmail.com",
  "amandajaguella@gmail.com",
  "eduardatonet25@gmail.com"
];
const ADMIN_EMAIL = "chimellogustavo17@gmail.com";
const bootScreen   = document.getElementById("bootScreen");
const loginScreen  = document.getElementById("loginScreen");
const appContent   = document.getElementById("appContent");
const loginForm    = document.getElementById("loginForm");
const loginEmail   = document.getElementById("loginEmail");
const loginPassword= document.getElementById("loginPassword");
const loginError   = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const toggleModeBtn = document.getElementById("toggleModeBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminBadge = document.getElementById("adminBadge");
let isSignUpMode = false;
let bootFinished = false;
let authResolved = false;
let isLoggedIn = false;
let isAdmin = false;
let achievementsInitialized = false;
let profilesInitialized = false;
let friendOverridesInitialized = false;
let eggUnlocksInitialized = false;
let currentUserEmail = null;
// A tela de boot fica visível por, no mínimo, ~2.2s (duração da barra de
// carregamento), mesmo que o Firebase responda mais rápido que isso.
setTimeout(()=>{ bootFinished = true; revealAfterBoot(); }, 2200);
auth.onAuthStateChanged(user => {
  authResolved = true;
  if (user && !ALLOWED_EMAILS.includes((user.email || "").toLowerCase())) {
    // E-mail não autorizado: desloga na hora e avisa na tela de login.
    auth.signOut();
    isLoggedIn = false;
    isAdmin = false;
    currentUserEmail = null;
    loginError.textContent = "Este e-mail não tem permissão de acesso a este arquivo.";
    revealAfterBoot();
    return;
  }
  isLoggedIn = !!user;
  isAdmin = !!user && user.email.toLowerCase() === ADMIN_EMAIL;
  currentUserEmail = user ? user.email.toLowerCase() : null;
  adminBadge.style.display = isAdmin ? "inline-block" : "none";
  // Renderiza na hora com os dados locais (FRIENDS), sem esperar o Firestore.
  // Assim o badge "Você" e afins aparecem mesmo que as regras do Firestore
  // ainda não tenham sido atualizadas (nesse caso só as conquistas/perfis
  // ao vivo é que ficam pendentes, mas a identificação de quem é você não).
  if (isLoggedIn) { renderAll(); }
  if (isLoggedIn && !achievementsInitialized) {
    achievementsInitialized = true;
    initAchievementsSync();
  }
  if (isLoggedIn && !profilesInitialized) {
    profilesInitialized = true;
    initProfilesSync();
  }
  if (isLoggedIn && !friendOverridesInitialized) {
    friendOverridesInitialized = true;
    listenFriendOverrides();
  }
  if (isLoggedIn && !eggUnlocksInitialized) {
    eggUnlocksInitialized = true;
    listenEggUnlocks();
  }
  revealAfterBoot();
});
function revealAfterBoot(){
  if(!bootFinished || !authResolved) return;
  bootScreen.classList.add("fade-out");
  setTimeout(()=> bootScreen.style.display = "none", 650);
  if(isLoggedIn){
    loginScreen.style.display = "none";
    appContent.style.display = "block";
  } else {
    appContent.style.display = "none";
    loginScreen.style.display = "flex";
  }
}
loginForm.addEventListener("submit", (e)=>{
  e.preventDefault();
  loginError.textContent = "";
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.textContent = isSignUpMode ? "Criando..." : "Entrando...";
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  const action = isSignUpMode
    ? auth.createUserWithEmailAndPassword(email, password)
    : auth.signInWithEmailAndPassword(email, password);
  action
    .then(()=>{ /* onAuthStateChanged cuida da troca de tela */ })
    .catch(err => { loginError.textContent = traduzErroFirebase(err); })
    .finally(()=>{
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = isSignUpMode ? "Criar acesso" : "Entrar";
    });
});
toggleModeBtn.addEventListener("click", ()=>{
  isSignUpMode = !isSignUpMode;
  loginSubmitBtn.textContent = isSignUpMode ? "Criar acesso" : "Entrar";
  toggleModeBtn.textContent = isSignUpMode ? "Já tem conta? Entrar" : "Ainda não tem conta? Criar acesso";
  loginError.textContent = "";
});
googleLoginBtn.addEventListener("click", ()=>{
  const provider = new firebase.auth.GoogleAuthProvider();
  loginError.textContent = "";
  auth.signInWithPopup(provider).catch(err => { loginError.textContent = traduzErroFirebase(err); });
});
logoutBtn.addEventListener("click", ()=>{
  auth.signOut();
});
function traduzErroFirebase(err){
  const map = {
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "Esse e-mail já tem uma conta.",
    "auth/weak-password": "Senha muito fraca (mínimo 6 caracteres).",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/popup-closed-by-user": "Login com Google cancelado.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "Configuração do Firebase incompleta — edite firebaseConfig no script.js."
  };
  return map[err.code] || ("Erro ao entrar: " + err.message);
}
/* ============================================================
   DADOS
   Baseado nos registros reais fornecidos (nomes, datas, tipo
   sanguíneo, cor dos olhos, status e número de identificação).
   Campos sem informação ficam em branco e aparecem como "—".
   EQUIPES: cada amigo pode pertencer a UMA OU MAIS equipes.
   - Se pertence a só uma:  team: "bigbang"
   - Se pertence às duas:   teams: ["bigbang", "raccoon"]
   NOVOS CAMPOS POR AMIGO:
   - hobbies: []                       → lista de hobbies favoritos
   - firstAppearance: { quando, descricao }
     → "First Appearance" estilo ficha de HQ.
   - lembrancas: []                    → LEMBRANÇA DO DIA. Lista de
     frases sobre o membro; a cada dia uma diferente aparece no
     dossiê, rotacionando automaticamente (dia 1 mostra a 1ª, dia 2
     a 2ª, e quando acaba volta pro início). Quanto mais frases,
     mais dias sem repetir. Exemplos:
       "A música favorita do membro é ______."
       "Curiosidade: o membro gosta de ______."
       "No dia __/__ o membro realizou ______."
     Lista vazia mostra "nenhum registro catalogado".
============================================================ */
const TEAMS = {
  bigbang: {
    name: "The Big Bang Hypothesis",
    eyebrow: "Equipe Principal",
    color: "cyan"
  },
  raccoon: {
    name: "Furious Raccoon Inc.",
    eyebrow: "Equipe Secundária",
    color: "red"
  },
  solo: {
    name: "Sem Equipe",
    eyebrow: "Membros Independentes",
    color: "grey"
  }
};
// Equipes que têm sistema de conquistas de verdade (Firestore). "solo" fica
// de fora de propósito: é só uma aba pra deixar visível quem ainda não tem
// equipe — sem mural de troféus, sem sugestão, sem nada disso.
const ACHIEVEMENT_TEAMS = ["bigbang", "raccoon"];
let FRIENDS = [
  // ---------- RANK 1 (empate) — Olavo primeiro, depois Eduarda ----------
  { id:1, rank:1, name:"Olavo Xavier Vieira", gender:"M", team:"bigbang", isBest:true,
    role:"Melhor Amigo / Irmão", membership:"Membro Fundador",
    codename:"The True Gamer , AppleJuice , Cream Boy",
    classe:"Membro Fundador",
    email:"olavoxavier038@gmail.com",
    dob:"05/03", sexo:"Masculino", tipoSanguineo:"O-", corOlhos:"Castanhos", height:"1,77", status:"Ativo", idNum:"MM01",
    bio:"Meu irmão. Compreensivo, leal e presente de um jeito raro de encontrar. Nossa amizade nasceu em um período de certa forma difícil da minha vida, e conhecê-lo foi, sem dúvida, a melhor coisa que aconteceu naquela fase. O que começou por gostos em comum e conversas realmente interessantes logo se transformou em algo muito maior: uma relação de irmandade construída sobre confiança, respeito e apoio mútuo. É uma das pessoas mais inteligentes que já conheci. No início, essa inteligência foi um dos motivos que me aproximaram dele, mas, com o tempo, percebi que o que realmente importa é quem ele é. Seu caráter, sua personalidade, a forma como trata as pessoas e a maneira como me compreendeu fizeram com que ele se tornasse alguém indispensável na minha vida. É a pessoa em quem mais confio, com quem mais me sinto à vontade para conversar sobre qualquer assunto e ser eu mesmo. É uma das raras pessoas com quem me sinto completamente confortável, até mesmo com abraços. Sou muito grato por poder chamá-lo de meu melhor amigo e meu irmão.",
    stats:{lealdade:100,humor:97,confiabilidade:100, Carisma : 95, Habilidades_Sociais: 79, Maturidade:80, Criatividade:87, Energia_Social:78, Disposicao:74, Nivel_De_Fofura:35},
    qualidades:["Empatia","Inteligência","Humor","Cultura","Talento","Aprende rápido","Energia social"],
    defeitos:["Às vezes indisciplinado"],
    hobbies:["Jogos", "DnD", "Música", "Leitura de HQs e Livros", "Filmes/Séries", "Desenhar"],
    firstAppearance:{ quando:"22/08/2024 - 1ª Temporada", descricao:"Meu primeiro dia na turma de Auxiliar de Estatística. Saionara nos colocou no mesmo grupo." },
    lembrancas:[
      "A música favorita do Olavo é Jigsaw Falling Into Place de Radiohead.",
      "Olavo gosta de gansos e patos.",
      "O personagem favorito do Olavo é o Hellboy.",
      "Primeiro contato entre Olavo e Gustavo foi no dia 22/08/2024.",
      "Olavo atende pelos codinomes The True Gamer, AppleJuice e Cream Boy.",
      "O jogo favorito do Olavo é Disco Elysium."
    ],
    neuro:{status:"possivel", detalhes:"TDA e/ou Altas Habilidades"},
    accent:"#ffcc00",
    photo:"fotos/olavox.jpeg",
    actorPhoto:"", actorName:""
  },
  { id:2, rank:1, name:"Eduarda Tonet", gender:"F", team:"raccoon", highPriority:true,
    role:"Melhor Amiga", membership:"Membro Fundador",
    classe:"Membro Fundador",
    email:"eduardatonet25@gmail.com",
    dob:"25/10", sexo:"Feminino", tipoSanguineo:"B+", corOlhos:"Verdes", height:"1,73", status:"Ativo", idNum:"MF01",
    bio:".",
    stats:{lealdade:99,humor:80,confiabilidade:99, Carisma : 79, Habilidades_Sociais: 88, Maturidade:84, Criatividade:79, Energia_Social:80, Disposicao:84, Nivel_De_Fofura:40},
    hobbies:["Futebol", "Música", "Filmes/Séries", "Desenhar"],
    firstAppearance:{ quando:"Prequel", descricao:"A primeira pessoa com quem falei na turma do ensino médio. Perguntei se aquela era a minha turma, e ela respondeu que sim." },
    lembrancas:[],
    accent:"#1fe90d",
    photo:"",
    actorPhoto:"", actorName:""
  },
  // ---------- RESTANTE DO RANKING (2º ao 10º) ----------
  { id:3, rank:2, name:"William de Oliveira Camillo Furquim", gender:"M", team:"bigbang",
    role:"Amigo 2", membership:"Membro Fundador",
    codename:"O Willuminado", classe:"Membro Fundador",
    email:"williamfurquim@hotmail.com",
    dob:"05/09", sexo:"Masculino", tipoSanguineo:"AB-", corOlhos:"Castanhos", height:"1,71", status:"Ativo", idNum:"AM02",
    bio:"Persistiu em se aproximar de mim mesmo diante das minhas tentativas sistemáticas de afastamento, algo digno de nota, considerando que a maioria das pessoas recua após dois ou três sinais claros de retração social. Usou a mesma estratégia com a Amanda, só que levou mais tempo. Nossos gostos apresentaram uma sobreposição estatisticamente significativa, o que naturalmente facilitou a convivência. Além disso, demonstrou um comportamento notavelmente raro: foi gentil comigo sem interesse utilitário ou temporário, o que desafia o modus operandi da maior parte das interações humanas. E, surpreendentemente, não apenas tolera como parece apreciar minha excentricidade. Como consequência inevitável desse conjunto de fatores, desenvolvi uma estima por ele, passei a gostar dele, e está em segundo lugar na minha lista de amigos, ou seja, a segunda posição de quem eu fico mais confortável.",
    stats:{lealdade:96,humor:94,confiabilidade:96, Carisma : 93, Habilidades_Sociais: 95, Maturidade:80, Criatividade:77, Energia_Social:70, Disposicao:80, Nivel_De_Fofura:30},
    qualidades:["Calmo, não se estressa à toa","Evita conflitos","Persistente","Compreensivo","O que mais se esforça","Empático","Cuida dos amigos"],
    defeitos:["Jogar LOL (Olavo também)","Pode-se irritá-lo (raramente)"],
    hobbies:["Futebol", "Jogos/LOL", "Música", "Leitura", "Filmes/Séries"],
    firstAppearance:{ quando:"1ª Temporada", descricao:"Em nosso primeiro contato ele veio até mim e o Olavo perguntando se alguém tinha falado em Darth Vader. Ele também aproveitou o fato de eu ter mencionado, na apresentação da Saionara, que meu vilão favorito era o Dr. Destino." },
    lembrancas:[
      "A música favorita do William é Still Loving You de Scorpions.",
      "Curiosidade: William gosta de Lady Gaga.",
      "Amanda e William começaram a namorar dia 10/03/2025.",
      "William já foi campeão de Xadrez.",
      "William ganhou vários trofeus no futebol.",
      "William provavelmente é o membro mais humano da equipe."
    ],
    accent:"#3d3c3c",
    photo:"fotos/william.jpeg",
    actorPhoto:"", actorName:""
  },
  { id:4, rank:3, name:"Lucas Miyaki da Cruz", gender:"M", team:"bigbang",
    role:"Amigo 3", membership:"Membro Fundador",
    classe:"Membro Fundador",
    email:"lumimiyaki@gmail.com",
    dob:"24/07", sexo:"Masculino", tipoSanguineo:"O+", corOlhos:"Castanhos", height:"1,89", status:"Ativo", idNum:"AM03",
    bio:"Lucas é um grande aliado e amigo, gentil, simpático e leal, com um cuidado genuíno em fazer as pessoas ao redor se sentirem bem. Isso pode ser bom, mas vale lembrar que não precisa se esforçar tanto para agradar, as pessoas gostam dele pela pessoa que ele já é, e tudo bem também quando nem todo mundo se agrada, isso não mudaria o seu valor. Tem grandes habilidades e uma inteligência de verdade, só falta ele confiar mais nisso, se subestima com uma frequência que não faz jus ao que realmente entrega. É também um ótimo anfitrião — recebe bem, cuida dos detalhes e faz questão de que todo mundo se sinta confortável em qualquer lugar que ele esteja. E é precavido, do tipo que já pensou um passo à frente e tem um plano B pronto antes mesmo de precisar dele.",
    stats:{lealdade:89,humor:70,confiabilidade:89, Carisma : 74, Habilidades_Sociais: 80, Maturidade:77, Criatividade:77, Energia_Social:76, Disposicao:76, Nivel_De_Fofura:75},
    qualidades:["Generoso","Respeitoso","Humilde","Agradável","Bom anfitrião","Inteligente","Precavido financeiramente"],
    defeitos:["Pouca Confiança","Pouca Autoestima"],
    hobbies:["Jogos", "Música", "Origami"],
    firstAppearance:{ quando:"22/08/2024 - 1ª Temporada", descricao:"Saionara misturou os grupos, meu e do Olavo com o do Lucas. Quando mencionei que gostava da DC, a Ketlen desaprovou, e ele disse que era para deixar eu continuar gostando dela." },
    lembrancas:[
      "O jogo favorito do Lucas é Clair Obscure Expedition 33.",
      "A série favorita do Lucas é Gravity Falls.",
      "Lucas é o membro mais alto da equipe: 1,89 de altura.",
      "Lucas faz origami, e não é uma ideia estereotipada, ele realmente faz.",
      "Lucas gosta mais de músicas orquestradas do que de músicas com letra, como de jogos.",
    ],
    accent:"#3dc015",
    photo:"",
    actorPhoto:"", actorName:""
  },
  { id:5, rank:4, name:"Pedro Henrique", gender:"M", team:"solo",
    role:"Amigo 4", membership:"Membro",
    classe:"Membro",
    dob:"11/04", sexo:"Masculino", tipoSanguineo:"O+", corOlhos:"Castanhos", status:"Ativo", idNum:"AM04",
    bio:".",
    stats:{lealdade:90,humor:82,confiabilidade:90, Carisma : 85, Habilidades_Sociais: 92, Maturidade:78, Criatividade:74, Energia_Social:87, Disposicao:79, Nivel_De_Fofura:25},
    hobbies:["Música", "Leitura", "Filmes/Séries", "Festas"],
    firstAppearance:{ quando:"Prequel", descricao:"Primeiro contato no curso de Logística do SENAI, durante o primeiro trabalho em grupo de apresentação." },
    lembrancas:[],
    accent:"#8b8a86",
    photo:"",
    actorPhoto:"", actorName:""
  },
  { id:6, rank:5, name:"Igor Vieira Prux", gender:"M", team:"raccoon",
    role:"Amigo 5", membership:"Membro Fundador",
    classe:"Membro Fundador",
    dob:"13/06", sexo:"Masculino", tipoSanguineo:"O-", corOlhos:"Castanhos", status:"Ativo", idNum:"AM05",
    bio:".",
    stats:{lealdade:87,humor:90,confiabilidade:87, Carisma : 90, Habilidades_Sociais: 94, Maturidade:80, Criatividade:79, Energia_Social:80, Disposicao:72, Nivel_De_Fofura:10},
    hobbies:["Música", "Filmes/Séries", "Desenhar", "Moto"],
    firstAppearance:{ quando:"Prequel", descricao:"A professora o colocou no mesmo grupo que Eduarda, Bárbara e eu; depois, começamos a fazer outros trabalhos com essa formação de equipe." },
    lembrancas:[],
    accent:"#8600bb",
    photo:"",
    actorPhoto:"", actorName:""
  },
  { id:7, rank:6, name:"Bárbara Ferreira", gender:"F", team:"raccoon",
    role:"Amiga 6", membership:"Membro Fundador",
    classe:"Membro Fundador",
    neuro:{status:"possivel", detalhes:"TDAH"},
    dob:"13/11", sexo:"Feminino", tipoSanguineo:"O-", corOlhos:"Castanhos", status:"Ativo", idNum:"AF02",
    bio:".",
    stats:{lealdade:86,humor:86,confiabilidade:86, Carisma : 95, Habilidades_Sociais: 97, Maturidade:72, Criatividade:70, Energia_Social:87, Disposicao:70, Nivel_De_Fofura:20},
    hobbies:["Música", "Alguns livros", "Filmes/Séries", "Festas"],
    firstAppearance:{ quando:"Prequel", descricao:"Primeiro contato em um trabalho em grupo de português, no qual a Eduarda também estava. Ela perguntou se eu queria que ela cortasse uma folha para o trabalho; foi a segunda pessoa que falei depois de Eduarda." },
    lembrancas:[],
    accent:"#f806d8",
    photo:"",
    actorPhoto:"", actorName:""
  },
  { id:8, rank:7, name:"Amanda Jaguella da Silva", gender:"F", team:"bigbang",
    role:"Amiga 7", membership:"Membro Principal",
    classe:"Membro Principal",
    email:"amandajaguella@gmail.com",
    dob:"06/10", sexo:"Feminino", tipoSanguineo:"O+", corOlhos:"Verdes", height:"1,60", status:"Ativo", idNum:"AF03",
    bio:".",
    stats:{lealdade:74,humor:70,confiabilidade:80, Carisma : 72, Habilidades_Sociais: 86, Maturidade:78, Criatividade:75, Energia_Social:67, Disposicao:75, Nivel_De_Fofura:40},
    qualidades:["Decidida","Pontual","Esperta","Corajosa","Criativa","Engraçada","Interessante","Planejadora","Precavida","Dedicada","Delicada","Se veste bem"],
    qualidadesNota:"(fora as qualidades como namorada do William)",
    defeitos:["Preocupada","Emocional"],
    hobbies:[],
    firstAppearance:{ quando:"2ª Temporada", descricao:"Os primeiros contatos ocorreram quando eu a acompanhava com o William. Depois que ele concluiu seu arco tentando namorá-la, ela passou a integrar a equipe." },
    lembrancas:[
      "Amanda e William começaram a namorar dia 10/03/2025.",
      "Amanda entrou oficialmente na equipe na 2ª Temporada.",
      "Amanda gosta de vermelho.",
    ],
    accent:"#aa2800",
    photo:"",
    actorPhoto:"", actorName:""
  },
  { id:9, rank:8, name:"Arthur Fiorese de Andrade", gender:"M", team:"solo",
    role:"Amigo 8", membership:"TI",
    classe:"TI",
    dob:"11/09", sexo:"Masculino", tipoSanguineo:"", corOlhos:"Castanhos", status:"Ativo", idNum:"AM08",
    bio:".",
    stats:{lealdade:90,humor:92,confiabilidade:90, Carisma : 96, Habilidades_Sociais: 96, Maturidade:78, Criatividade:86, Energia_Social:80, Disposicao:79, Nivel_De_Fofura:25},
    hobbies:["Jogos", "DnD", "Música", "Leitura de HQs e Livros", "Pixel Art"],
    firstAppearance:{ quando:"3ª Temporada", descricao:"Primeiro contato ao iniciar meu estágio na TI da Câmara de Vereadores." },
    lembrancas:[],
    neuro:{status:"confirmada", detalhes:"TDAH e Bipolaridade"},
    accent:"#5fe4a6",
    photo:"",
    actorPhoto:"", actorName:""
  },
  { id:10, rank:9, name:"Victor Menegat", gender:"M", team:"raccoon",
    role:"Amigo 9", membership:"Membro",
    classe:"Membro",
    dob:"", sexo:"Masculino", tipoSanguineo:"B+", corOlhos:"Castanhos", status:"Ativo", idNum:"AM09",
    bio:".",
    stats:{lealdade:77,humor:79,confiabilidade:77, Carisma : 86, Habilidades_Sociais: 90, Maturidade:78, Criatividade:75, Energia_Social:70, Disposicao:72, Nivel_De_Fofura:12},
    hobbies:["Música", "Filmes/Séries"],
    firstAppearance:{ quando:"Prequel", descricao:"Eduarda já o conhecia; ele chegou à nossa turma no último ano do ensino médio e, com o tempo, passou a ter mais contato com a equipe, tornando-se um membro honorário." },
    lembrancas:[],
    accent:"#c70b0b",
    photo:"",
    actorPhoto:"", actorName:""
  },
  // ---------- VOCÊ — membro das duas equipes ----------
  { id:0, rank:null, name:"Gustavo Chimello", gender:"M", teams:["bigbang","raccoon"],
    role:"Membro Fundador TBBH / FR Inc.", membership:"Membro Fundador",
    codename:"Legendary Blue Raccoon / Pirate Raccoon / Detective Raccoon, Robô, Backend das Trevas, Vigilante, Menino Maluquinho, Voz do Google, Gênio, Avatar, Autistinha, Capitão América, Robin, O Backend, O Fofo do Grupo",
    classe:"Membro Fundador",
    email:"chimellogustavo17@gmail.com",
    dob:"17/05", sexo:"Masculino", tipoSanguineo:"AB+", corOlhos:"Verdes", height:"1.70", status:"Ativo", idNum:"",
    bio:".",
    stats:{lealdade:100,humor:80,confiabilidade:100, Carisma : 77, Habilidades_Sociais: 42, Maturidade:80, Criatividade:86, Energia_Social:60, Disposicao:76, Nivel_De_Fofura:80},
    qualidades:["Mais inteligente do grupo","Carismático","Fofo", "Empatia","Humor","Mantém a palavra","Memória","Empenhado","Reservado","Seletivo","Cultura","Companheiro"],
    defeitos:["Habilidades sociais","Conexões emocionais","Contato familiar"],
    hobbies:["Filmes/Séries", "Leitura de HQs e Livros", "Música", "Jogos", "Edição", "Escrever", "Desenhar", "DnD"],
    firstAppearance:{ quando:"Blue Beetle #1", descricao:"The Road So Far." },
    lembrancas:[
      "A música favorita do Gustavo é Adagio in D Minor de John Murphy.",
      "Primeiro contato entre Olavo e Gustavo foi no dia 22/08/2024.",
      "Gustavo já foi medalhista de ouro na OBA (Olimpíada Brasileira de Astronomia e Astronáutica).",
      "Gustavo recebeu menção honrosa na ONC (Olimpíada Nacional de Ciências).",
      "Os personagens favoritos do Gustavo são o Senhor Destino e o Questão.",
      "Gustavo gosta de guaxinins.",
      "Gustavo prefere músicas orquestradas a músicas com letra, embora também goste de rock, jazz, e algumas outras vertentes.",
    ],
    neuro:{status:"confirmada", detalhes:"Autismo e Altas Habilidades"},
    accent:"#2be0c8",
    photo:"",
    actorPhoto:"", actorName:""
  },
  // ---------- MEMBROS EXTRAS (fora do Top 10, aparecem só nas equipes) ----------
  // Conta de teste para o admin experimentar a visão de um usuário comum
  // (não-admin). Pode remover depois, é só apagar este bloco.
  { id:11, rank:null, name:"Rocket Raccoon", gender:"M", team:"solo",
    role:"Conta de Teste", membership:"Conta de Teste",
    codename:"Rocky",
    classe:"Membro Guardiões da Galáxia",
    email:"oimperiocontraataca7@gmail.com",
    dob:"07/07/1976", sexo:"Masculino", tipoSanguineo:"", corOlhos:"Castanhos/Vermelhos", height:"1,22", status:"Ativo", idNum:"89P13",
    bio:".",
    stats:{lealdade:89,humor:99,confiabilidade:85, Maturidade:79, Criatividade:86, Energia_Social:80, Disposicao:80, Nivel_De_Fofura:94},
    hobbies:["Colecionar próteses"],
    firstAppearance:{ quando:"Marvel Preview #7 (1976)", descricao:"Primeiro contato com ele ao salvar o multiverso de um demônio interdimensional." },
    lembrancas:[],
    neuro:{status:"confirmada", detalhes:"Guaxinim geneticamente modificado."},
    accent:"#8b5cf6",
    photo:"",
    actorPhoto:"", actorName:""
  },
  /*{ id:12, rank:11, name:"Kaio Manfro da Silva", gender:"M", team:"raccoon",
    role:"Membro Honorário", membership:"Membro Honorário",
    codename:"O Segundo Guaxinim", classe:"Membro Honorário",
    dob:"Pendente", sexo:"Masculino", tipoSanguineo:"Pendente", corOlhos:"Castanhos", status:"Ativo", idNum:"IMS03",
    bio:"Um dos primeiros integrantes da equipe secundária. Ainda um capítulo em construção — mais informações em breve.",
    quote:"“Em breve...”",
    stats:{lealdade:62,humor:65,confiabilidade:58,caos:60},
    accent:"#ff5b5b",
    photo:"" // ex: "fotos/kaio.jpg" (deixe vazio para usar o avatar gerado)
  },
  { id:13, rank:12, name:"Bruno Henrique Marconi Coelho", gender:"M", team:"bigbang",
    role:"Membro Honorário", membership:"Membro Honorário",
    codename:"O Honorário", classe:"Membro Honorário",
    dob:"Pendente", sexo:"Masculino", tipoSanguineo:"Pendente", corOlhos:"Pendente", status:"Ativo", idNum:"Pendente",
    bio:"Reconhecido como membro honorário da equipe principal. Perfil ainda em atualização.",
    quote:"“Em breve...”",
    stats:{lealdade:60,humor:60,confiabilidade:60,caos:30},
    accent:"#4fd8ea",
    photo:"" // ex: "fotos/bruno.jpg" (deixe vazio para usar o avatar gerado)
  },
  */
];
if (authResolved && isLoggedIn) {
  renderAll();
}
/* ============================================================
  EASTER EGGS — ÍCONES ESCONDIDOS + CARTAS COLECIONÁVEIS
   Como funciona:
   - Cada membro abaixo tem um ícone secreto escondido em algum
     canto do site (os pontos de esconderijo são os <span
     class="hidden-egg" data-egg="ID"> no index.html — o data-egg
     é o friendId; pra mudar o esconderijo, é só mover o span).
   - O ícone fica quase invisível (bem apagado) e só revela a cor
     quando o mouse passa em cima. Ao CLICAR no ícone de um membro,
     quem clicou desbloqueia a carta de infância DAQUELE membro na
     seção 04 — cada usuário tem sua própria coleção (salva no
     Firestore por e-mail).
  - O admin já enxerga todas as cartas desbloqueadas, pra testar
    (por isso os ícones somem da visão do admin — pra ver os
    esconderijos como um usuário comum, logue com a conta Rocket).
   PLACEHOLDERS PRA VOCÊ TROCAR:
  - icon: o emoji/símbolo escondido ou o caminho de uma imagem.
  - childPhoto: caminho da carta de infância (ex: "fotos/crianca_olavo.jpg").
   ESCONDERIJOS ATUAIS (mova os spans no index.html se quiser):
   - Gustavo (0): fim do subtítulo do header
   - Olavo (1): descrição da seção 01 (Lista de Amigos)
   - Lucas (4): descrição da seção 02 (Equipes & Conquistas)
   - William (3): "FIM DA TRANSMISSÃO" no rodapé
   REGRA DO FIRESTORE (adicione junto das outras):
   match /eggUnlocks/{email} {
     allow read: if request.auth != null &&
       request.auth.token.email in
       ['chimellogustavo17@gmail.com','olavoxavier038@gmail.com',
        'williamfurquim@hotmail.com','oimperiocontraataca7@gmail.com',
        'lumimiyaki@gmail.com','amandajaguella@gmail.com','eduardatonet25@gmail.com'];
     allow write: if request.auth != null &&
       request.auth.token.email == email;
   }
============================================================ */
const EASTER_EGGS = [
  { friendId:0, firstName:"Gustavo", icon:"fotos/Raccoon_Goose.png", childPhoto:"fotos/crianca_gustavo.jpeg" },
  { friendId:1, firstName:"Olavo", icon:"fotos/Geese.png", childPhoto:"fotos/crianca_olavo.jpeg" },
  { friendId:3, firstName:"William", icon:"fotos/capybara.png", childPhoto:"fotos/crianca_william.jpeg" },
  { friendId:4, firstName:"Lucas", icon:"fotos/red_panda.png", childPhoto:"fotos/crianca_lucas.jpeg" }
];
const SECRET_CARDS = [
  { id:"bigbang-1", title:"The Big Bang Hypothesis", photo:"fotos/bigbang_hypothesis_1.jpeg", trigger:"Título da equipe", icon:"🌌" },
  { id:"bigbang-2", title:"TBBH Livros", photo:"fotos/bigbang_hypothesis_2.jpeg", trigger:"Título da equipe", icon:"⚛️" },
  { id:"gustavo-questao", title:"Questão", photo:"fotos/gustavo_questao.jpeg", trigger:"ícone da Questão", icon:"❓" },
  { id:"gustavo-vigilante", title:"Vigilante", photo:"fotos/Vij.jpg", trigger:"ator de Gustavo", icon:"🎬" },
  { id:"olavo-gustavo", title:"Irmãos", photo:"fotos/olavo_gustavo.jpeg", trigger:"irmãos na bio do Olavo", icon:"🤝" },
  { id:"gustavo-void", title:"Void", photo:"fotos/void.jpeg", trigger:"escuridão", icon:"🌑" },
  { id:"gustavo-musica", title:"Spencer Chase", photo:"fotos/rocky.jpeg", trigger:"música na bio do Gustavo", icon:"🎵" },
  { id:"olavo-musica", title:"Rock", photo:"fotos/Rock.jpeg", trigger:"música na bio do Olavo", icon:"🎶" },
  { id:"william-musica", title:"Terminator", photo:"fotos/Terminator.jpeg", trigger:"música na bio do William", icon:"🎸" },
  { id:"olavo-jedi", title:"Jedi", photo:"fotos/olavo_jedi.jpeg", trigger:"ícone secreto do Olavo", icon:"⚔️" },
  { id:"olavo-redhood", title:"Como Vencer a Timidez com as Mulheres", photo:"fotos/Como Vencer a Timidez com as Mulheres.jpeg", trigger:"ícone secreto do Olavo", icon:"🔴" },
  { id:"william-secret", title:"William", photo:"fotos/william_posando.jpeg", trigger:"ícone secreto do William", icon:"🕶️" }
];
// Cinco cartas novas, separadas das cartas secretas antigas.
const DRAWING_CARDS = [
  { id:"drawing-gustavo-robin", title:"Desenho - Olavo", photo:"fotos/Desenho Olavo.jpeg", trigger:"ícone dos desenhos", icon:"🎨" },
  { id:"drawing-gustavo-questao", title:"Tempestade - Gustavo", photo:"fotos/Tempestade - Gustavo.jpeg", trigger:"ícone dos desenhos", icon:"🎨" },
  { id:"drawing-olavo-gustavo", title:"Desenho - Gustavo", photo:"fotos/Desenho - Gustavo.jpeg", trigger:"ícone dos desenhos", icon:"🎨" },
  { id:"drawing-william-lendo", title:"Desenho Personagem Gustavo", photo:"fotos/Desenho Personagem Gustavo.jpeg", trigger:"ícone dos desenhos", icon:"🎨" },
  { id:"drawing-lucas-dormindo", title:"Desenho para o Thiago", photo:"fotos/Desenho para o Thiago.jpeg", trigger:"ícone dos desenhos", icon:"🎨" }
];
const DRAWING_CARD_IDS = DRAWING_CARDS.map(card => card.id);
let EGG_UNLOCKS = []; // IDs de cartas desbloqueadas pelo usuário logado
function eggDocRef(email){ return db.collection("eggUnlocks").doc(email.toLowerCase()); }
function listenEggUnlocks(){
  if (!currentUserEmail) return;
  eggDocRef(currentUserEmail).onSnapshot(snap=>{
    const data = snap.data();
    EGG_UNLOCKS = (data && Array.isArray(data.unlockedIds)) ? data.unlockedIds : [];
    renderEggs();
    renderCards();
  }, err => console.warn("Erro ao sincronizar cartas desbloqueadas", err));
}
// Admin já tem tudo desbloqueado (pra testar); os demais só o que acharam.
function isEggUnlocked(friendId){
  return isAdmin || EGG_UNLOCKS.some(id => String(id) === String(friendId));
}
function unlockCards(cardIds){
  if (!currentUserEmail) return;
  const newIds = cardIds.filter(id => !isEggUnlocked(id));
  if (!newIds.length) return;
  const allCards = [...SECRET_CARDS, ...DRAWING_CARDS];
  const firstCard = allCards.find(item => item.id === newIds[0]);
  const isDrawingSet = newIds.length > 1 && newIds.every(id => DRAWING_CARD_IDS.includes(id));
  EGG_UNLOCKS = [...EGG_UNLOCKS, ...newIds];
  renderEggs();
  renderCards();
  updateCardTriggerVisibility();
  eggDocRef(currentUserEmail).set({
    unlockedIds: firebase.firestore.FieldValue.arrayUnion(...newIds)
  }, { merge: true }).catch(err => console.warn("Não foi possível salvar a carta", err));
  showToast(
    isDrawingSet ? "🎨" : (firstCard ? firstCard.icon : "🃏"),
    isDrawingSet ? "5 cartas desbloqueadas" : "carta desbloqueada",
    isDrawingSet ? "coleção de desenhos" : (firstCard ? firstCard.title : "infância")
  );
  if (isDrawingSet) {
    logActivity("bigbang", "unlocked", "desbloqueou as <b>5 cartas de desenho</b> 🎨");
  } else {
    const unlockedTitle = firstCard ? firstCard.title : "carta de infância";
    logActivity("bigbang", "unlocked", `desbloqueou a carta <b>${unlockedTitle}</b> 🃏`);
  }
}
function unlockEgg(friendId){
  unlockCards([friendId]);
}
// Preenche os spans .hidden-egg do HTML com o ícone de cada membro e
// liga o clique. Ícones já encontrados somem da página (a carta fica
// registrada na seção 04).
function renderEggs(){
  document.querySelectorAll(".hidden-egg").forEach(el=>{
    const friendId = parseInt(el.dataset.egg);
    const egg = EASTER_EGGS.find(e => e.friendId === friendId);
    if (!egg) { el.style.display = "none"; return; }
    if (egg.icon.includes("/")) {
      el.innerHTML = `<img src="${egg.icon}" alt="Ícone secreto de ${egg.firstName}" loading="lazy">`;
    } else {
      el.textContent = egg.icon;
    }
    const unlocked = isEggUnlocked(friendId);
    el.classList.toggle("found", unlocked);
    el.style.display = unlocked ? "none" : "inline-block";
    if (!el.dataset.bound) {
      el.dataset.bound = "1";
      el.addEventListener("click", ()=> unlockEgg(friendId));
    }
  });
  updateCardTriggerVisibility();
}
// Seção 04: galeria de cartas. Bloqueada = verso com "?"; desbloqueada =
// foto com moldura dourada e brilho de colecionável.
function renderCards(){
  const grid = document.getElementById("cardsGrid");
  const progress = document.getElementById("cardsProgress");
  if (!grid) return;
  const cards = [
    ...EASTER_EGGS.map(egg => ({ id:egg.friendId, photo:egg.childPhoto, title:`${egg.firstName} quando criança`, owner:egg.firstName, icon:egg.icon })),
    ...SECRET_CARDS.map(card => ({ ...card, id:card.id, owner:card.trigger })),
    ...DRAWING_CARDS.map(card => ({ ...card, id:card.id, owner:card.trigger }))
  ];
  const unlockedCardCount = cards.filter(card => isEggUnlocked(card.id)).length;
  progress.innerHTML = `coleção: <b>${unlockedCardCount}/${cards.length}</b> cartas desbloqueadas${isAdmin ? ` <span style="color:var(--yellow)">★ visão de admin — tudo liberado</span>` : ""}`;
  grid.innerHTML = cards.map(card=>{
    if (isEggUnlocked(card.id)) {
      return `
      <div class="friend-card unlocked">
        <div class="card-photo">
          <img src="${card.photo}" alt="${card.title}" loading="lazy"
            onerror="this.parentElement.innerHTML='<div class=\\'card-photo-empty\\'>🖼️</div>'">
        </div>
        <div class="card-footer">
          <div class="card-name">${card.title}</div>
          <div class="card-edition">${typeof card.id === "number" ? "edição infância" : "edição ilustrada"} · colecionável</div>
        </div>
      </div>`;
    }
    return `
    <div class="friend-card locked">
      <div class="card-q">?</div>
      <div class="card-hint">carta bloqueada<br>encontre o ícone para desbloquear esta carta</div>
    </div>`;
  }).join("");
}
function cardTrigger(text, ids, className="card-trigger"){
  const idList = Array.isArray(ids) ? ids.join(",") : ids;
  return `<span class="${className}" data-unlock="${idList}" role="button" tabindex="0">${text}</span>`;
}
function renderBioWithTriggers(f){
  let bio = f.bio || "";
  if (f.id === 1) {
    let hasBrotherTrigger = false;
    bio = bio.replace(/irmãos?/i, match => {
      hasBrotherTrigger = true;
      return cardTrigger(match, "olavo-gustavo");
    });
    if (!hasBrotherTrigger) bio += ` ${cardTrigger("irmão", "olavo-gustavo")}`;
    let hasMusicTrigger = false;
    bio = bio.replace(/música/gi, match => {
      hasMusicTrigger = true;
      return cardTrigger(match, "olavo-musica");
    });
    if (!hasMusicTrigger) bio += ` ${cardTrigger("🎵", "olavo-musica", "card-trigger bio-icon-trigger hide-after-unlock")}`;
  }
  if (f.id === 3) {
    let hasMusicTrigger = false;
    bio = bio.replace(/música/gi, match => {
      hasMusicTrigger = true;
      return cardTrigger(match, "william-musica");
    });
    if (!hasMusicTrigger) bio += ` ${cardTrigger("🎵", "william-musica", "card-trigger bio-icon-trigger hide-after-unlock")}`;
  }
  if (f.id === 0) {
    let hasMusicTrigger = false;
    bio = bio.replace(/música/gi, match => {
      hasMusicTrigger = true;
      return cardTrigger(match, "gustavo-musica");
    });
    if (!hasMusicTrigger) bio += ` ${cardTrigger("🎵", "gustavo-musica", "card-trigger bio-icon-trigger hide-after-unlock")}`;
    bio += ` ${cardTrigger("🌑", "gustavo-void", "card-trigger void-trigger hide-after-unlock")}`;
  }
  return bio;
}
/* ============================================================
   GATILHOS DE CARTA — POR DELEGAÇÃO DE EVENTO
   Um listener único no document, ligado UMA vez. Como ele escuta
   qualquer clique que "borbulha" até o topo, continua funcionando
   mesmo quando o conteúdo é re-renderizado pelos snapshots do
   Firestore (perfis, overrides, conquistas) — que era o que matava
   os listeners individuais de antes. Obs: sem stopPropagation, um
   clique no título da equipe desbloqueia as cartas E seleciona a
   aba ao mesmo tempo, que é o comportamento desejado.
============================================================ */
document.addEventListener("click", (event)=>{
  const el = event.target.closest(".card-trigger[data-unlock]");
  if (!el) return;
  unlockCards(el.dataset.unlock.split(","));
});
document.addEventListener("keydown", (event)=>{
  if (event.key !== "Enter" && event.key !== " ") return;
  const el = event.target.closest(".card-trigger[data-unlock]");
  if (!el) return;
  event.preventDefault();
  unlockCards(el.dataset.unlock.split(","));
});
function bindCardTriggers(){
  // Os cliques agora são tratados por delegação (acima). Esta função
  // fica mantida só pra atualizar a visibilidade dos gatilhos nos
  // pontos do código que já a chamavam.
  updateCardTriggerVisibility();
}
function updateCardTriggerVisibility(){
  document.querySelectorAll("[data-unlock].hide-after-unlock, [data-unlock].persist-after-unlock").forEach(el=>{
    const unlocked = el.dataset.unlock.split(",").every(id => isEggUnlocked(id));
    if (unlocked && el.classList.contains("persist-after-unlock")) {
      el.classList.remove("card-trigger", "persist-after-unlock");
      el.removeAttribute("data-unlock");
      el.removeAttribute("title");
      return;
    }
    el.style.display = unlocked ? "none" : "inline-block";
  });
}
/* ============================================================
   TOAST GENÉRICO (conquistas e cartas)
============================================================ */
function showToast(icon, label, title){
  const toast = document.getElementById("unlockToast");
  document.getElementById("unlockToastIcon").textContent = icon || "🏆";
  document.getElementById("unlockToastLabel").textContent = label || "conquista mais recente";
  document.getElementById("unlockToastTitle").textContent = title || "—";
  toast.style.display = "none";
  toast.style.animation = "none";
  void toast.offsetWidth; // reinicia a animação CSS
  toast.style.animation = "";
  toast.style.display = "flex";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>{ toast.style.display = "none"; }, 6800);
}
/* ============================================================
   ATENÇÃO: este objeto agora é só a "SEMENTE" inicial.
   A partir do primeiro login do admin, os dados de verdade passam
   a viver no Firestore (coleção "achievements", um documento por
   equipe) e são sincronizados ao vivo — o que estiver aqui só é
   usado para popular o banco na primeira vez.
   REGRAS DO FIRESTORE (cole em Firestore Database > Regras):
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /achievements/{team} {
         allow read: if request.auth != null &&
           request.auth.token.email in
           ['chimellogustavo17@gmail.com','olavoxavier038@gmail.com','williamfurquim@hotmail.com','oimperiocontraataca7@gmail.com','lumimiyaki@gmail.com','amandajaguella@gmail.com','eduardatonet25@gmail.com'];
         allow write: if request.auth != null &&
           request.auth.token.email == 'chimellogustavo17@gmail.com';
       }
     }
   }
   Lembre de ATIVAR o Firestore Database no console do Firebase
   (Build > Firestore Database > Criar banco de dados) antes de
   colar essas regras. Faça o primeiro login como admin
   (chimellogustavo17@gmail.com) para que os dados sejam criados.
============================================================ */
const ACHIEVEMENTS = {
  bigbang: [
    { icon:"🌍", title:"Descendência Internacional", desc:"Encontrar um amigo descendente de estrangeiros (Lucas).", unlocked:true },
    { icon:"😏", title:"Recrutamento Duvidoso", desc:"William envolver outras pessoas em seus planos de ter coito.", unlocked:true },
    { icon:"🎮", title:"Gamecon", desc:"Participar da Gamecon com o grupo.", unlocked:true },
    { icon:"🥇", title:"Nova Medalha", desc:"Gustavo ganhar outra medalha de física.", unlocked:false },
    { icon:"🏆", title:"Conquista Coletiva", desc:"O grupo ganhar algo importante.", unlocked:false },
    { icon:"💛", title:"Olavo e sua Penny", desc:"Referência não tão secreta ao universo Big Bang Theory.", unlocked:false },
    { icon:"👩‍🔬", title:"William e sua Bernadette", desc:"Outra referência ao universo Big Bang Theory.", unlocked:true },
    { icon:"📸", title:"Foto de Elenco", desc:"Tirar a foto do grupo, estilo abertura de série.", unlocked:false },
    { icon:"📚", title:"Peregrinação Nerd", desc:"Levar uma das personagens na loja de quadrinhos.", unlocked:true },
    { icon:"🔫", title:"Paintball", desc:"Fazer uma partida de paintball em grupo.", unlocked:false },
    { icon:"🎳", title:"Boliche", desc:"Uma noite de boliche com o grupo.", unlocked:false },
    { icon:"🍜", title:"Comida Tailandesa (Alternativa)", desc:"Ir na sorveteria do lado do EPI, porque é mais legal.", unlocked:false },
    { icon:"🍝", title:"Comida Italiana", desc:"Jantar italiano em grupo.", unlocked:true },
    { icon:"📜", title:"Contratos em Geral", desc:"Formalizar acordos importantes do grupo.", unlocked:true },
    { icon:"📄", title:"Contrato do Grupo", desc:"Redigir o contrato oficial do grupo.", unlocked:false },
    { icon:"💍", title:"Contrato de Relacionamento", desc:"Contrato de relacionamento entre William e Amanda.", unlocked:false },
    { icon:"🍽️", title:"Janta", desc:"Uma janta em grupo, sem ocasião especial nenhuma.", unlocked:true },
    { icon:"🕹️", title:"Madrugada de Castle Crashers", desc:"Zerar Castle Crashers em uma única madrugada.", unlocked:true },
    { icon:"🔍", title:"Investigação", desc:"Investigar um assassinato (jogo de tabuleiro/RPG).", unlocked:false },
    { icon:"🐦", title:"Gaio-Azul", desc:"Encontrar um gaio-azul.", unlocked:false },
    { icon:"🦝", title:"Guaxinim de Estimação", desc:"Gustavo ter um guaxinim.", unlocked:false },
    { icon:"🎵", title:"Música Autoral", desc:"Uma música feita por William e Lucas.", unlocked:false },
    { icon:"🧖", title:"Momento de Vulnerabilidade", desc:"William acha importante que os membros masculinos do grupo se vejam nus em algum momento, de forma plausível.", unlocked:false },
    { icon:"🌳", title:"Árvore em Israel", desc:"William comprar uma árvore em Israel.", unlocked:false },
    { icon:"🧸", title:"Bonecos Colecionáveis", desc:"Bonecos de Amanda, William e Lucas.", unlocked:false }
  ],
  raccoon: []
};
// Dados "ao vivo", vindos do Firestore. Começam como cópia da semente
// acima e são substituídos assim que o primeiro snapshot chega.
let ACH_LIVE = JSON.parse(JSON.stringify(ACHIEVEMENTS));
let achievementsLoaded = { bigbang:false, raccoon:false };
function achDocRef(team){ return db.collection("achievements").doc(team); }
// Garante que cada equipe tenha um documento no Firestore. Só o admin
// tem permissão de escrita, então isso só funciona de verdade quando
// quem logar primeiro for o admin — é o esperado para popular o banco.
async function seedAchievementsIfNeeded(){
  if (!isAdmin) return;
  for (const team of Object.keys(ACHIEVEMENTS)) {
    try {
      const snap = await achDocRef(team).get();
      if (!snap.exists) {
        const seeded = ACHIEVEMENTS[team].map((a, i) => ({
          ...a,
          id: `${team}-seed-${i}`,
          reactions: {},
          unlockedAt: a.unlocked ? Date.now() : null
        }));
        await achDocRef(team).set({ list: seeded });
      }
    } catch (err) {
      console.warn("Não foi possível preparar os dados de", team, err);
    }
  }
}
function listenAchievements(){
  Object.keys(ACHIEVEMENTS).forEach(team=>{
    achDocRef(team).onSnapshot(snap=>{
      const data = snap.data();
      ACH_LIVE[team] = (data && Array.isArray(data.list)) ? data.list : [];
      achievementsLoaded[team] = true;
      if (isLoggedIn) { renderTabs(); renderAchievements(); }
      maybeShowLastUnlockToast();
    }, err => {
      console.warn("Erro ao sincronizar conquistas de", team, err);
    });
  });
}
async function initAchievementsSync(){
  await seedAchievementsIfNeeded();
  listenAchievements();
  listenReactions();
  listenSuggestions();
  listenActivity();
}
// Admin: alterna uma conquista entre desbloqueada/bloqueada.
function toggleAchievement(team, index){
  if (!isAdmin) return;
  const current = (ACH_LIVE[team] || [])[index];
  if (!current) return;
  const newUnlocked = !current.unlocked;
  const updated = { ...current, unlocked: newUnlocked, unlockedAt: newUnlocked ? Date.now() : current.unlockedAt };
  const list = (ACH_LIVE[team] || []).map((a, i) => i === index ? updated : a);
  achDocRef(team).set({ list });
  if (newUnlocked) {
    notifyUnlock(team, updated);
    logActivity(team, "unlocked", `desbloqueou a conquista <b>${updated.title}</b>`);
  } else {
    logActivity(team, "locked", `bloqueou novamente a conquista <b>${updated.title}</b>`);
  }
}
// Admin: adiciona uma nova conquista à equipe ativa.
function addAchievement(team, achievement){
  if (!isAdmin) return;
  const full = {
    id: achievement.id || `${team}-${Date.now()}`,
    icon: achievement.icon, title: achievement.title, desc: achievement.desc,
    unlocked: !!achievement.unlocked,
    unlockedAt: achievement.unlocked ? Date.now() : null,
    reactions: {}
  };
  const list = [...(ACH_LIVE[team] || []), full];
  achDocRef(team).set({ list });
  logActivity(team, "added", `adicionou a conquista <b>${full.title}</b>`);
  if (full.unlocked) notifyUnlock(team, full);
}
/* ============================================================
   REAÇÕES — coleção separada pra TODOS poderem reagir
   As reações moram na coleção "reactions" (um documento por
   equipe), e não mais dentro de "achievements". Assim todos os
   membros podem escrever reações sem ganharem permissão de
   mexer nas conquistas em si (que continuam só do admin).
   Formato do documento: { [idDaConquista]: { [emoji]: [emails] } }
   REGRA DO FIRESTORE (adicione junto das outras):
   match /reactions/{team} {
     allow read, write: if request.auth != null &&
       request.auth.token.email in
       ['chimellogustavo17@gmail.com','olavoxavier038@gmail.com',
        'williamfurquim@hotmail.com','oimperiocontraataca7@gmail.com',
        'lumimiyaki@gmail.com','amandajaguella@gmail.com','eduardatonet25@gmail.com'];
   }
============================================================ */
let REACT_LIVE = { bigbang:{}, raccoon:{} };
function reactDocRef(team){ return db.collection("reactions").doc(team); }
function listenReactions(){
  ACHIEVEMENT_TEAMS.forEach(team=>{
    reactDocRef(team).onSnapshot(snap=>{
      REACT_LIVE[team] = snap.data() || {};
      if (isLoggedIn) renderAchievements();
    }, err => console.warn("Erro ao sincronizar reações de", team, err));
  });
}
// Qualquer usuário logado pode reagir com um emoji a uma conquista.
// arrayUnion/arrayRemove só mexem no próprio e-mail, então dois membros
// reagindo ao mesmo tempo não sobrescrevem a reação um do outro.
function reactToAchievement(team, achievementId, emoji){
  if (!currentUserEmail) return;
  const current = ((REACT_LIVE[team] || {})[achievementId] || {})[emoji] || [];
  const op = current.includes(currentUserEmail)
    ? firebase.firestore.FieldValue.arrayRemove(currentUserEmail)
    : firebase.firestore.FieldValue.arrayUnion(currentUserEmail);
  reactDocRef(team).set({ [achievementId]: { [emoji]: op } }, { merge: true })
    .catch(err => console.warn("Não foi possível salvar a reação", err));
}
/* ============================================================
   NOTIFICAÇÃO POR E-MAIL (extensão "Trigger Email" do Firebase)
   Não dá pra mandar e-mail direto do navegador com segurança, então
   isso usa a extensão oficial e gratuita do Firebase: ela observa a
   coleção "mail" e manda o e-mail sozinha quando um documento novo
   aparece lá. Passos pra ativar (uma vez só, no console):
   1. Console do Firebase > Extensions > Explorar > procure
      "Trigger Email" (da própria Firebase) > Instalar.
   2. Durante a instalação, ela pede um servidor SMTP — dá pra usar
      um Gmail com "senha de app", ou um serviço gratuito como
      Brevo/SendGrid/Mailgun. Configure com as credenciais.
   3. Confirme que o nome da coleção configurado é "mail" (é o
      padrão sugerido pela própria extensão).
   4. Regra do Firestore pra essa coleção (adicione junto das outras):
      match /mail/{doc} {
        allow read: if false;
        allow write: if request.auth != null &&
          request.auth.token.email == 'chimellogustavo17@gmail.com';
      }
   Sem instalar a extensão, esta função apenas grava o documento na
   coleção "mail" e não acontece mais nada — nenhum erro, só não
   chega e-mail nenhum até a extensão estar instalada.
============================================================ */
function notifyUnlock(team, achievement){
  db.collection("mail").add({
    to: ALLOWED_EMAILS,
    message: {
      subject: `🏆 Conquista desbloqueada — ${achievement.title}`,
      text: `A conquista "${achievement.title}" foi desbloqueada na equipe ${TEAMS[team].name}!\n\n${achievement.desc}\n\nEntre no site pra conferir.`
    }
  }).catch(err => console.warn("Não foi possível enfileirar o e-mail", err));
}
/* ============================================================
   FEED DE ATIVIDADE
   Coleção "activity": um documento por evento, mais recentes primeiro.
   REGRA DO FIRESTORE (adicione junto das outras):
   match /activity/{doc} {
     allow read, create: if request.auth != null &&
       request.auth.token.email in
       ['chimellogustavo17@gmail.com','olavoxavier038@gmail.com',
        'williamfurquim@hotmail.com','oimperiocontraataca7@gmail.com',
        'lumimiyaki@gmail.com','amandajaguella@gmail.com','eduardatonet25@gmail.com'];
     allow update, delete: if false;
   }
============================================================ */
function logActivity(team, type, messageHtml){
  const actor = findFriendByEmail(currentUserEmail);
  db.collection("activity").add({
    team, type,
    actorName: actor ? actor.name : (currentUserEmail || "alguém"),
    message: messageHtml,
    ts: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(err => console.warn("Não foi possível registrar atividade", err));
}
const ACTIVITY_ICONS = { unlocked:"🏆", locked:"🔒", added:"✨", suggested:"💡", approved:"✅", rejected:"❌" };
function listenActivity(){
  db.collection("activity").orderBy("ts","desc").limit(20).onSnapshot(snap=>{
    const feed = document.getElementById("activityFeed");
    if (!feed) return;
    if (snap.empty) {
      feed.innerHTML = `<div class="ach-empty">Nenhuma atividade registrada ainda.</div>`;
      return;
    }
    feed.innerHTML = snap.docs.map(doc=>{
      const a = doc.data();
      const teamName = TEAMS[a.team] ? TEAMS[a.team].name : "";
      const when = a.ts && a.ts.toDate ? a.ts.toDate().toLocaleString("pt-BR") : "agora";
      return `
      <div class="activity-item">
        <div class="activity-icon">${ACTIVITY_ICONS[a.type] || "•"}</div>
        <div>
          <div class="activity-text"><b>${a.actorName}</b> ${a.message}${teamName ? ` <span class="mono">(${teamName})</span>` : ""}</div>
          <div class="activity-time">${when}</div>
        </div>
      </div>`;
    }).join("");
  }, err => console.warn("Erro ao carregar feed de atividade", err));
}
/* ============================================================
   SUGESTÕES DE CONQUISTA
   Coleção "suggestions", um documento por equipe (igual achievements).
   REGRA DO FIRESTORE (adicione junto das outras):
   match /suggestions/{team} {
     allow read, write: if request.auth != null &&
       request.auth.token.email in
       ['chimellogustavo17@gmail.com','olavoxavier038@gmail.com',
        'williamfurquim@hotmail.com','oimperiocontraataca7@gmail.com',
        'lumimiyaki@gmail.com','amandajaguella@gmail.com','eduardatonet25@gmail.com'];
   }
   (Aqui deixamos todo mundo autorizado escrever, porque tanto enviar
   sugestão quanto aprovar/rejeitar são ações legítimas de qualquer
   um dos membros — o botão de aprovar/rejeitar já só aparece pra
   quem é admin na interface, mas a regra em si é mais permissiva.)
============================================================ */
let SUGG_LIVE = { bigbang:[], raccoon:[] };
let suggestionsLoaded = { bigbang:false, raccoon:false };
function suggDocRef(team){ return db.collection("suggestions").doc(team); }
function listenSuggestions(){
  Object.keys(TEAMS).forEach(team=>{
    suggDocRef(team).onSnapshot(snap=>{
      const data = snap.data();
      SUGG_LIVE[team] = (data && Array.isArray(data.list)) ? data.list : [];
      suggestionsLoaded[team] = true;
      if (isLoggedIn) renderSuggestions();
    }, err => console.warn("Erro ao sincronizar sugestões de", team, err));
  });
}
function submitSuggestion(team, suggestion){
  if (!currentUserEmail) return;
  const actor = findFriendByEmail(currentUserEmail);
  const full = {
    id: `${team}-sugg-${Date.now()}`,
    icon: suggestion.icon, title: suggestion.title, desc: suggestion.desc,
    unlocked: !!suggestion.unlocked,
    proposedByEmail: currentUserEmail,
    proposedByName: actor ? actor.name : currentUserEmail,
    proposedAt: Date.now()
  };
  const list = [...(SUGG_LIVE[team] || []), full];
  suggDocRef(team).set({ list });
  logActivity(team, "suggested", `sugeriu a conquista <b>${full.title}</b>`);
}
function approveSuggestion(team, suggId){
  if (!isAdmin) return;
  const target = (SUGG_LIVE[team] || []).find(s => s.id === suggId);
  if (!target) return;
  const list = (SUGG_LIVE[team] || []).filter(s => s.id !== suggId);
  suggDocRef(team).set({ list });
  addAchievement(team, { icon: target.icon, title: target.title, desc: target.desc, unlocked: target.unlocked });
  logActivity(team, "approved", `aprovou a sugestão <b>${target.title}</b> (enviada por ${target.proposedByName})`);
}
function rejectSuggestion(team, suggId){
  if (!isAdmin) return;
  const target = (SUGG_LIVE[team] || []).find(s => s.id === suggId);
  const list = (SUGG_LIVE[team] || []).filter(s => s.id !== suggId);
  suggDocRef(team).set({ list });
  if (target) logActivity(team, "rejected", `rejeitou a sugestão <b>${target.title}</b>`);
}
function renderSuggestions(){
  const panel = document.getElementById("suggPendingPanel");
  const list = document.getElementById("suggPendingList");
  const pending = SUGG_LIVE[activeTeam] || [];
  if (!isAdmin || !pending.length) {
    panel.style.display = "none";
  } else {
    panel.style.display = "block";
    list.innerHTML = pending.map(s => `
      <div class="sugg-pending-item">
        <div class="sugg-pending-icon">${s.icon || "🏆"}</div>
        <div class="sugg-pending-body">
          <div class="sugg-pending-title-text">${s.title}</div>
          <div class="sugg-pending-desc">${s.desc}</div>
          <div class="sugg-pending-meta">sugerido por ${s.proposedByName}${s.unlocked ? " · já aconteceu" : ""}</div>
          <div class="sugg-pending-actions">
            <button class="sugg-btn approve" data-id="${s.id}">Aprovar</button>
            <button class="sugg-btn reject" data-id="${s.id}">Rejeitar</button>
          </div>
        </div>
      </div>
    `).join("");
    list.querySelectorAll(".approve").forEach(btn=>{
      btn.addEventListener("click", ()=> approveSuggestion(activeTeam, btn.dataset.id));
    });
    list.querySelectorAll(".reject").forEach(btn=>{
      btn.addEventListener("click", ()=> rejectSuggestion(activeTeam, btn.dataset.id));
    });
  }
}
document.getElementById("suggAddBtn").addEventListener("click", ()=>{
  const icon = document.getElementById("suggIcon").value.trim() || "🏆";
  const title = document.getElementById("suggTitle").value.trim();
  const desc = document.getElementById("suggDesc").value.trim();
  const unlocked = document.getElementById("suggUnlocked").checked;
  if (!title || !desc) {
    alert("Preencha ao menos o título e a descrição da sugestão.");
    return;
  }
  submitSuggestion(activeTeam, { icon, title, desc, unlocked });
  document.getElementById("suggIcon").value = "";
  document.getElementById("suggTitle").value = "";
  document.getElementById("suggDesc").value = "";
  document.getElementById("suggUnlocked").checked = false;
  alert("Sugestão enviada! Ela aparece pro admin como pendente de aprovação.");
});
/* ============================================================
   TOAST ESTILO STEAM (última conquista desbloqueada)
============================================================ */
let toastShownThisSession = false;
function maybeShowLastUnlockToast(){
  if (toastShownThisSession) return;
  if (!achievementsLoaded.bigbang || !achievementsLoaded.raccoon) return;
  const all = [...(ACH_LIVE.bigbang || []), ...(ACH_LIVE.raccoon || [])]
    .filter(a => a.unlocked && a.unlockedAt);
  if (!all.length) return;
  const mostRecent = all.reduce((best, a) => (a.unlockedAt > best.unlockedAt ? a : best), all[0]);
  toastShownThisSession = true;
  showToast(mostRecent.icon || "🏆", "conquista mais recente", mostRecent.title);
}
/* ============================================================
   PERFIS DE USUÁRIO (foto de perfil)
   Guardadas no Firestore, coleção "profiles", um documento por
   e-mail (não por uid, assim qualquer login autorizado consegue
   ler a foto dos demais e mostrar na bio).
   REGRAS ADICIONAIS DO FIRESTORE (junte com as de "achievements"
   no mesmo arquivo de regras):
   match /profiles/{email} {
     allow read: if request.auth != null &&
       request.auth.token.email in
       ['chimellogustavo17@gmail.com','olavoxavier038@gmail.com',
        'williamfurquim@hotmail.com','oimperiocontraataca7@gmail.com',
        'lumimiyaki@gmail.com','amandajaguella@gmail.com','eduardatonet25@gmail.com'];
     allow write: if request.auth != null && request.auth.token.email == email;
   }
============================================================ */
let PROFILES_LIVE = {}; // { "email@x.com": { photoDataUrl: "data:image/jpeg;base64,..." } }
function profileDocRef(email){ return db.collection("profiles").doc(email.toLowerCase()); }
function initProfilesSync(){
  ALLOWED_EMAILS.forEach(email=>{
    profileDocRef(email).onSnapshot(snap=>{
      PROFILES_LIVE[email.toLowerCase()] = snap.data() || {};
      renderMyProfileWidget();
      renderRanking();
      renderCharGrid();
      renderCharDetail();
    }, err=>{
      console.warn("Erro ao sincronizar perfil de", email, err);
    });
  });
}
// Redimensiona e comprime a imagem no navegador (canvas) antes de salvar,
// pra caber tranquilamente no limite de tamanho de um documento do Firestore.
function readAndCompressImage(file, maxSize=320, quality=0.75){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = (e)=>{
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo não é uma imagem válida."));
      img.onload = ()=>{
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
// Encontra, dentre os amigos cadastrados, aquele que corresponde ao
// e-mail atualmente logado (se houver).
function findFriendByEmail(email){
  if (!email) return null;
  return FRIENDS.find(f => f.email && f.email.toLowerCase() === email.toLowerCase()) || null;
}
// A foto "ao vivo" (enviada pelo próprio usuário) tem prioridade sobre a
// foto estática cadastrada em FRIENDS; isCurrentUser marca quando o
// personagem sendo exibido é o dono da conta logada.
function livePhotoFor(f){
  if (!f.email) return null;
  const p = PROFILES_LIVE[f.email.toLowerCase()];
  return (p && p.photoDataUrl) || null;
}
function isCurrentUser(f){
  return !!(f.email && currentUserEmail && f.email.toLowerCase() === currentUserEmail);
}
function renderMyProfileWidget(){
  const avatarEl = document.getElementById("myProfileAvatar");
  const nameEl = document.getElementById("myProfileName");
  if (!avatarEl || !currentUserEmail) return;
  const matched = findFriendByEmail(currentUserEmail);
  if (matched) {
    avatarEl.innerHTML = avatarSVG(matched);
    nameEl.textContent = matched.name;
  } else {
    avatarEl.innerHTML = fallbackAvatarSVG({ id:"me", name: currentUserEmail, accent:"#3ddbf0" });
    nameEl.textContent = currentUserEmail;
  }
}
document.getElementById("changePhotoBtn").addEventListener("click", ()=>{
  document.getElementById("profilePhotoInput").click();
});
document.getElementById("profilePhotoInput").addEventListener("change", async (e)=>{
  const file = e.target.files[0];
  if (!file || !currentUserEmail) return;
  const btn = document.getElementById("changePhotoBtn");
  const originalText = btn.textContent;
  btn.textContent = "Enviando...";
  btn.disabled = true;
  try {
    const dataUrl = await readAndCompressImage(file);
    await profileDocRef(currentUserEmail).set({ photoDataUrl: dataUrl }, { merge: true });
  } catch (err) {
    alert("Não foi possível processar essa imagem: " + err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
    e.target.value = "";
  }
});
/* ============================================================
   EDIÇÃO DE MEMBROS PELO ADMIN (bio, descrição/papel e foto)
   Guardado no Firestore, coleção "friendOverrides", um documento
   por membro (id do FRIENDS). Só sobrescreve os campos que o admin
   de fato preencheu — o resto continua vindo do array FRIENDS
   original no código.
   REGRA DO FIRESTORE (adicione junto das outras):
   match /friendOverrides/{id} {
     allow read: if request.auth != null &&
       request.auth.token.email in
       ['chimellogustavo17@gmail.com','olavoxavier038@gmail.com',
        'williamfurquim@hotmail.com','oimperiocontraataca7@gmail.com',
        'lumimiyaki@gmail.com','amandajaguella@gmail.com','eduardatonet25@gmail.com'];
     allow write: if request.auth != null &&
       request.auth.token.email == 'chimellogustavo17@gmail.com';
   }
============================================================ */
let FRIEND_OVERRIDES_LIVE = {};
function friendOverrideDocRef(id){ return db.collection("friendOverrides").doc(String(id)); }
function listenFriendOverrides(){
  db.collection("friendOverrides").onSnapshot(snap=>{
    const map = {};
    snap.forEach(doc=>{ map[doc.id] = doc.data(); });
    FRIEND_OVERRIDES_LIVE = map;
    if (isLoggedIn) { renderRanking(); renderCharGrid(); renderCharDetail(); }
  }, err => console.warn("Erro ao sincronizar edições de membros", err));
}
// Mescla o membro original com qualquer edição do admin (bio/role/codename/ator).
// Campos vazios ou não definidos no override não sobrescrevem o original.
function withOverrides(f){
  const o = FRIEND_OVERRIDES_LIVE[String(f.id)];
  if (!o) return f;
  const neuro = (o.neuroStatus !== undefined)
    ? { status: o.neuroStatus, detalhes: (o.neuroDetalhes !== undefined ? o.neuroDetalhes : (f.neuro && f.neuro.detalhes) || "") }
    : f.neuro;
  return {
    ...f,
    bio: (o.bio !== undefined && o.bio !== "") ? o.bio : f.bio,
    role: (o.role !== undefined && o.role !== "") ? o.role : f.role,
    codename: (o.codename !== undefined && o.codename !== "") ? o.codename : f.codename,
    actorName: (o.actorName !== undefined && o.actorName !== "") ? o.actorName : f.actorName,
    neuro
  };
}
// Rótulo legível pra linha "Neurodivergência" na ficha de dados.
function neuroLabel(f){
  const n = f.neuro;
  if (!n || !n.status || n.status === "nenhuma") return "Nenhuma identificada";
  if (n.status === "confirmada") return n.detalhes ? `Confirmada — ${n.detalhes}` : "Confirmada (detalhes a definir)";
  if (n.status === "possivel") return n.detalhes ? `Possibilidade — ${n.detalhes}` : "Possibilidade (a definir)";
  return "Nenhuma identificada";
}
// Foto editada pelo admin (usada em avatarSVG com prioridade menor que a
// foto que a própria pessoa envia pelo perfil dela, se ela tiver login).
function overridePhotoFor(f){
  const o = FRIEND_OVERRIDES_LIVE[String(f.id)];
  return (o && o.photo) || null;
}
// Foto do "ator escalado" — segunda foto, sem relação com a pessoa real,
// representando quem interpretaria esse personagem numa adaptação.
function actorPhotoFor(f){
  const o = FRIEND_OVERRIDES_LIVE[String(f.id)];
  return (o && o.actorPhoto) || f.actorPhoto || null;
}
function actorFallbackHTML(){
  return `<div class="d-cast-photo-empty">🎭</div>`;
}
function actorAvatarHTML(f){
  const src = actorPhotoFor(f);
  if (src) {
    return `<img src="${src}" alt="Ator escalado para ${f.name}" loading="lazy"
      onerror="this.parentElement.innerHTML = window.__actorFallback(${f.id})">`;
  }
  return actorFallbackHTML();
}
// Exposto globalmente para o onerror inline do <img> do ator.
window.__actorFallback = function(){ return actorFallbackHTML(); };
function escapeHtml(str){
  return String(str || "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
}
/* ============================================================
   HELPERS
============================================================ */
// Retorna sempre um array de equipes, aceitando tanto "team" (string,
// uma equipe) quanto "teams" (array, uma ou mais equipes).
function friendTeams(f){
  if (Array.isArray(f.teams)) return f.teams.filter(Boolean);
  if (f.team) return [f.team];
  return [];
}
// Nomes de equipe legíveis para exibir, ignorando chaves inválidas
// (ex: team:"" ou team:"TI" que não existem em TEAMS).
function friendTeamNames(f){
  const names = friendTeams(f).map(key => TEAMS[key] ? TEAMS[key].name : null).filter(Boolean);
  return names.length ? names.join(" & ") : "Equipe não definida";
}
function avatarSVG(f){
  // Prioridade: foto enviada pelo próprio usuário (Firestore) > foto
  // editada pelo admin > foto estática cadastrada (campo "photo") >
  // avatar abstrato gerado.
  const src = livePhotoFor(f) || overridePhotoFor(f) || f.photo;
  if (src) {
    return `<img src="${src}" alt="${f.name}" loading="lazy"
      onerror="this.parentElement.innerHTML = window.__fallbackAvatar(${f.id})">`;
  }
  return fallbackAvatarSVG(f);
}
function fallbackAvatarSVG(f){
  const initials = f.name.split(" ").map(w=>w[0]).slice(0,2).join("");
  const grad = "g" + f.id;
  return `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="${grad}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${f.accent || '#3ddbf0'}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#070a10" stop-opacity="0.95"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" fill="#0e141f"/>
    <circle cx="100" cy="78" r="46" fill="url(#${grad})"/>
    <path d="M20 200 C20 140 60 118 100 118 C140 118 180 140 180 200 Z" fill="url(#${grad})" opacity="0.85"/>
    <text x="100" y="90" text-anchor="middle" font-family="Oswald, sans-serif" font-size="34" fill="#070a10" font-weight="700">${initials}</text>
  </svg>`;
}
// Exposto globalmente para o onerror inline do <img> conseguir chamar o fallback.
window.__fallbackAvatar = function(id){
  const f = FRIENDS.find(x => x.id === id);
  return f ? fallbackAvatarSVG(f) : "";
};
/* ============================================================
   RENDER: RANKING
============================================================ */
function renderRanking(){
  const list = document.getElementById("rankList");
  const top10 = FRIENDS.filter(f => f.rank && f.rank <= 10).map(withOverrides);
  const sorted = [...top10].sort((a,b)=>a.rank-b.rank || (a.gender==="M"?-1:1));
  list.innerHTML = sorted.map(f=>{
    let cls = "";
    let crown = "";
    if(f.isBest && f.gender==="M"){ cls="gold"; crown='<span class="crown"></span>'; }
    else if(f.isBest && f.gender==="F"){ cls="roseg"; crown='<span class="crown"></span>'; }
    else if(f.highPriority){ cls="roseg"; }
    return `
    <div class="rank-row ${cls}">
      <div class="rk">#${f.rank}</div>
      <div>
        <div class="info-name">${crown}${f.name}</div>
        <div class="info-role">${f.role || ""} · ${friendTeamNames(f)}</div>
      </div>
      <div class="tag-group">
        ${isCurrentUser(f) ? `<span class="tag you-tag">Você</span>` : ""}
        <div class="tag">${f.isBest ? "Prioridade Máxima" : (f.highPriority ? "Alta Prioridade" : "Ativo")}</div>
      </div>
    </div>`;
  }).join("");
}
/* ============================================================
   RENDER: TEAM TABS
============================================================ */
let activeTeam = "bigbang";
function renderTabs(){
  const wrap = document.getElementById("teamTabs");
  wrap.innerHTML = Object.keys(TEAMS).map(key=>{
    const t = TEAMS[key];
    const members = FRIENDS.filter(f => friendTeams(f).includes(key));
    const hasAch = ACHIEVEMENT_TEAMS.includes(key);
    const teamAch = ACH_LIVE[key] || [];
    const unlocked = teamAch.filter(a=>a.unlocked).length;
    const total = teamAch.length;
    return `
    <div class="team-tab ${key===activeTeam?"active":""}" data-team="${key}">
      <div class="t-eyebrow">${t.eyebrow}</div>
      <div class="t-name ${key === "bigbang" ? "card-trigger persist-after-unlock" : ""}" ${key === "bigbang" ? `data-unlock="bigbang-1,bigbang-2"` : ""}>${t.name}</div>
      <div class="t-meta">
        <span>Membros: <b>${members.length}</b></span>
        ${hasAch ? `<span>Conquistas: <b>${unlocked}/${total}</b></span>` : `<span>Somente informativo</span>`}
      </div>
    </div>`;
  }).join("");
  wrap.querySelectorAll(".team-tab").forEach(el=>{
    el.addEventListener("click", ()=>{
      activeTeam = el.dataset.team;
      renderAll();
    });
  });
  updateCardTriggerVisibility();
}
/* ============================================================
   RENDER: ACHIEVEMENTS
============================================================ */
function renderAchievements(){
  const grid = document.getElementById("achGrid");
  const adminForm = document.getElementById("achAdminForm");
  const suggForm = document.getElementById("suggForm");
  const suggPanel = document.getElementById("suggPendingPanel");
  if (!ACHIEVEMENT_TEAMS.includes(activeTeam)) {
    grid.innerHTML = `<div class="ach-empty">Este grupo é só pra deixar as informações dos membros visíveis — sem sistema de conquistas.</div>`;
    adminForm.style.display = "none";
    suggForm.style.display = "none";
    suggPanel.style.display = "none";
    return;
  }
  suggForm.style.display = "";
  if (!achievementsLoaded[activeTeam]) {
    grid.innerHTML = `<div class="ach-empty">Carregando conquistas...</div>`;
    adminForm.style.display = "none";
    return;
  }
  const list = ACH_LIVE[activeTeam] || [];
  if(!list.length){
    grid.innerHTML = `<div class="ach-empty">Nenhuma conquista cadastrada ainda para esta equipe. Em breve...</div>`;
  } else {
    grid.innerHTML = list.map((a, i)=>`
      <div class="ach-card ${a.unlocked ? "unlocked":"locked"}">
        <div class="ach-icon">${a.unlocked ? a.icon : "🔒"}</div>
        <div class="ach-body">
          <div class="ach-title"><span>${a.title}</span>${a.rarity ? `<span class="rarity">${a.rarity}</span>` : ""}</div>
          <div class="ach-desc">${a.desc}</div>
          <div class="ach-progress"><div class="ach-progress-fill" style="width:${a.unlocked?100:0}%"></div></div>
          ${a.unlocked ? `<div class="ach-date">${a.date || "Confirmado"}</div>` : `<div class="ach-date">Ainda não desbloqueado</div>`}
          ${renderReactions(a)}
          ${isAdmin ? `<button class="ach-toggle" data-idx="${i}">${a.unlocked ? "Bloquear" : "Desbloquear"}</button>` : ""}
        </div>
      </div>
    `).join("");
  }
  if (isAdmin) {
    grid.querySelectorAll(".ach-toggle").forEach(btn=>{
      btn.addEventListener("click", ()=> toggleAchievement(activeTeam, parseInt(btn.dataset.idx)));
    });
  }
  grid.querySelectorAll(".ach-react-btn").forEach(btn=>{
    btn.addEventListener("click", ()=> reactToAchievement(activeTeam, btn.dataset.id, btn.dataset.emoji));
  });
  adminForm.style.display = isAdmin ? "flex" : "none";
  renderSuggestions();
}
const QUICK_REACTIONS = ["👍","❤️","😂","🎉"];
function renderReactions(a){
  // Reações agora vêm da coleção "reactions" (separada das conquistas,
  // pra todos os membros poderem reagir). Obs: reações antigas, salvas
  // dentro da própria conquista, não são migradas — só o admin conseguia
  // salvá-las, então o histórico perdido é mínimo.
  const reactions = (REACT_LIVE[activeTeam] || {})[a.id] || {};
  return `<div class="ach-reactions">${QUICK_REACTIONS.map(emoji=>{
    const emails = reactions[emoji] || [];
    const mine = currentUserEmail && emails.includes(currentUserEmail);
    return `<button class="ach-react-btn ${mine ? "mine" : ""}" data-id="${a.id}" data-emoji="${emoji}">${emoji}${emails.length ? ` <span class="count">${emails.length}</span>` : ""}</button>`;
  }).join("")}</div>`;
}
// Formulário de admin para adicionar conquistas (existe uma vez só no HTML;
// sempre adiciona na equipe que estiver selecionada no momento do clique).
document.getElementById("newAchAddBtn").addEventListener("click", ()=>{
  if (!isAdmin) return;
  const icon = document.getElementById("newAchIcon").value.trim() || "🏆";
  const title = document.getElementById("newAchTitle").value.trim();
  const desc = document.getElementById("newAchDesc").value.trim();
  const unlocked = document.getElementById("newAchUnlocked").checked;
  if (!title || !desc) {
    alert("Preencha ao menos o título e a descrição da conquista.");
    return;
  }
  addAchievement(activeTeam, { icon, title, desc, unlocked });
  document.getElementById("newAchIcon").value = "";
  document.getElementById("newAchTitle").value = "";
  document.getElementById("newAchDesc").value = "";
  document.getElementById("newAchUnlocked").checked = false;
});
/* ============================================================
   RENDER: CHARACTER SELECT
============================================================ */
let selectedId = null;
function renderCharGrid(){
  const grid = document.getElementById("charGrid");
  const members = FRIENDS
    .filter(f => friendTeams(f).includes(activeTeam))
    .sort((a,b)=>(a.rank ?? 999)-(b.rank ?? 999));
  if(!members.length){ grid.innerHTML = ""; selectedId = null; return; }
  if(!members.find(m=>m.id===selectedId)) selectedId = members[0].id;
  grid.innerHTML = members.map(f=>`
    <div class="thumb ${f.id===selectedId?"selected":""}" data-id="${f.id}">
      ${f.isBest ? `<div class="lock-badge">★</div>` : (f.highPriority ? `<div class="priority-badge">◆</div>` : "")}
      ${isCurrentUser(f) ? `<div class="you-badge">VOCÊ</div>` : ""}
      <div class="thumb-avatar">${avatarSVG(f)}</div>
      ${f.id === 1 ? `<div class="goose-badge"><img src="fotos/Goose.png" alt="Goose" loading="lazy"></div>` : ""}
      <div class="thumb-label">${f.name.split(" ")[0]}</div>
    </div>
  `).join("");
  grid.querySelectorAll(".thumb").forEach(el=>{
    el.addEventListener("click", ()=>{
      selectedId = parseInt(el.dataset.id);
      renderCharGrid();
      renderCharDetail();
    });
  });
}
/* ============================================================
   RENDER: HOBBIES FAVORITOS
   Bloco de chips azuis. Lista vazia mostra "dados ainda não
   catalogados" em vez de sumir, pra ficha ficar sempre completa.
============================================================ */
function renderHobbies(f){
  const has = Array.isArray(f.hobbies) && f.hobbies.length;
  return `
  <div class="d-hobbies">
    <div class="d-hobbies-label mono">Hobbies</div>
    ${has
      ? `<div class="d-traits-chips">${f.hobbies.map(h=>`<span class="trait-chip hobby">${escapeHtml(h)}</span>`).join("")}</div>`
      : `<div class="d-hobbies-empty mono">dados ainda não catalogados</div>`}
  </div>`;
}
/* ============================================================
   RENDER: FIRST APPEARANCE (estilo ficha de HQ)
   "quando" faz papel de "número da edição" (data exata ou
   temporada) e "descricao" é o relato do primeiro encontro.
============================================================ */
function renderFirstAppearance(f){
  const fa = f.firstAppearance || {};
  return `
  <div class="d-firstapp">
    <div class="d-firstapp-head">
      <span class="d-firstapp-label mono">📖 first appearance</span>
      <span class="d-firstapp-issue">${escapeHtml(fa.quando || "—")}</span>
    </div>
    ${fa.descricao
      ? `<div class="d-firstapp-desc">${escapeHtml(fa.descricao)}</div>`
      : `<div class="d-firstapp-desc empty">Registro do primeiro encontro ainda não escrito.</div>`}
  </div>`;
}
/* ============================================================
   RENDER: LEMBRANÇA DO DIA
   Rotaciona automaticamente: a cada dia do ano, mostra uma frase
   diferente da lista "lembrancas" do membro (quando a lista acaba,
   volta pro início). O offset por id evita que todos os perfis
   troquem para o mesmo índice no mesmo dia.
============================================================ */
function dailyIndex(offset, len){
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return (dayOfYear + offset) % len;
}
function renderDailyMemory(f){
  const list = Array.isArray(f.lembrancas) ? f.lembrancas : [];
  if (!list.length) {
    return `
    <div class="d-memory">
      <div class="d-memory-head">
        <span class="d-memory-label mono">📅 lembrança do dia</span>
      </div>
      <div class="d-memory-text empty">Nenhum registro catalogado ainda. Volte outro dia.</div>
    </div>`;
  }
  const idx = dailyIndex(f.id, list.length);
  return `
  <div class="d-memory">
    <div class="d-memory-head">
      <span class="d-memory-label mono">📅 lembrança do dia</span>
      <span class="d-memory-counter">registro ${idx + 1}/${list.length}</span>
    </div>
    <div class="d-memory-text">${escapeHtml(list[idx])}</div>
    <div class="d-memory-footer">amanhã este arquivo revela outra lembrança</div>
  </div>`;
}
function renderCharDetail(){
  const raw = FRIENDS.find(x=>x.id===selectedId);
  const f = raw ? withOverrides(raw) : null;
  const detail = document.getElementById("charDetail");
  if(!f){ detail.innerHTML = ""; return; }
  const badgeMvp = f.isBest
    ? `<span class="d-badge ${f.gender==="M"?"mvp":"mvp-f"}">${f.gender==="M"?"★ Melhor Amigo / Irmão":"★ Melhor Amiga"}</span>`
    : (f.highPriority ? `<span class="d-badge mvp-f">◆ Alta Prioridade</span>` : "");
  const badgeYou = isCurrentUser(f) ? `<span class="d-badge you">★ Este é Você</span>` : "";
  // Um badge de equipe para CADA equipe da pessoa (suporta 1 ou 2 equipes).
  const teamBadges = friendTeams(f)
    .map(key => TEAMS[key] ? `<span class="d-badge team">${TEAMS[key].name}</span>` : "")
    .join("");
  const dataFields = [
    ["Data de Nascimento","dob"],
    ["Sexo","sexo"],
    ["Tipo Sanguíneo","tipoSanguineo"],
    ["Cor dos Olhos","corOlhos"],
    ["Altura","height"],
    ["Status","status"],
    ["Número de Identificação","idNum"]
  ];
  const dataRows = dataFields.map(([label,key]) => [label, f[key] || "—"]);
  dataRows.push(["Neurodivergência", neuroLabel(f)]);
  detail.innerHTML = `
    <div class="d-top">
      <div class="d-portrait">${avatarSVG(f)}</div>
      <div class="d-info">
        <div class="d-eyebrow">${f.membership || "Membro"} · ${f.rank ? "Rank #" + f.rank : "Fora do ranking"}</div>
        <div class="d-name">${f.name}</div>
        ${f.codename ? `<div class="d-codename">${f.codename}</div>` : ""}
        <div class="d-badges">
          ${teamBadges}
          ${f.membership ? `<span class="d-badge">${f.membership}</span>` : ""}
          ${badgeMvp}
          ${badgeYou}
        </div>
      </div>
    </div>
    ${f.id === 1 ? `
      <div class="d-bio-with-goose">
        <div class="d-bio-text">${renderBioWithTriggers(f)}</div>
        <div class="goose-bio-icon"><img src="fotos/Goose.png" alt="Goose" loading="lazy"></div>
      </div>
    ` : `<div class="d-bio">${renderBioWithTriggers(f)}</div>`}
    ${f.quote ? `<div class="d-quote">${f.quote}</div>` : ""}
    ${(f.qualidades || f.defeitos) ? `
    <div class="d-traits">
      ${f.qualidades ? `
      <div class="d-traits-col">
        <div class="d-traits-label good mono">✓ qualidades</div>
        <div class="d-traits-chips">${f.qualidades.map(q=>`<span class="trait-chip good">${escapeHtml(q)}</span>`).join("")}</div>
        ${f.qualidadesNota ? `<div class="d-traits-note">${escapeHtml(f.qualidadesNota)}</div>` : ""}
      </div>` : ""}
      ${f.defeitos ? `
      <div class="d-traits-col">
        <div class="d-traits-label bad mono">✕ defeitos</div>
        <div class="d-traits-chips">${f.defeitos.map(d=>`<span class="trait-chip bad">${escapeHtml(d)}</span>`).join("")}</div>
      </div>` : ""}
    </div>` : ""}
    ${renderHobbies(f)}
    ${renderFirstAppearance(f)}
    ${renderDailyMemory(f)}
    <div class="d-cast">
      <div class="d-cast-photo ${f.id === 0 ? "card-trigger" : ""}" ${f.id === 0 ? `data-unlock="gustavo-vigilante"` : ""}>${actorAvatarHTML(f)}</div>
      <div class="d-cast-info">
        <div class="d-cast-label mono">🎬 se fosse adaptado — ator escalado</div>
        <div class="d-cast-name">${f.actorName ? escapeHtml(f.actorName) : "Elenco ainda não definido"}</div>
      </div>
    </div>
    <div class="d-datalist">
      ${dataRows.map(([label,val])=>`
        <div class="d-data-row">
          <span class="d-data-label">${label}</span>
          <span class="d-data-value">${val}</span>
        </div>
      `).join("")}
    </div>
    <div class="d-stats">
      ${Object.entries(f.stats || {}).map(([k,v])=>`
        <div class="stat-row">
          <div class="stat-label"><span>${k}</span><span>${v}</span></div>
          <div class="stat-bar"><div class="stat-fill" style="width:${v}%"></div></div>
        </div>
      `).join("")}
    </div>
    <div class="d-file">arquivo.gerado // fonte: protocolo-amizade.sys // classificação: ${f.isBest ? "prioridade máxima" : "ativo padrão"}</div>
    ${isAdmin ? `
    <div class="admin-edit-block">
      <button id="editFriendBtn" class="ach-toggle">✎ Editar este membro (admin)</button>
      <div id="editFriendForm" class="edit-friend-form" style="display:none;">
        <label class="login-label">Descrição / Papel</label>
        <input id="editFriendRole" class="ach-admin-input full" value="${escapeHtml(f.role || "")}">
        <label class="login-label">Bio</label>
        <textarea id="editFriendBio" class="edit-friend-textarea">${escapeHtml(f.bio || "")}</textarea>
        <label class="login-label">Trocar foto</label>
        <input type="file" id="editFriendPhotoInput" accept="image/*" class="ach-admin-input full">
        <label class="login-label">🎬 Ator escalado — nome</label>
        <input id="editFriendActorName" class="ach-admin-input full" value="${escapeHtml(f.actorName || "")}" placeholder="Ex: Henry Cavill">
        <label class="login-label">🎬 Ator escalado — foto</label>
        <input type="file" id="editFriendActorPhotoInput" accept="image/*" class="ach-admin-input full">
        <label class="login-label">Neurodivergência</label>
        <select id="editFriendNeuroStatus" class="ach-admin-input full">
          <option value="nenhuma" ${(!f.neuro || !f.neuro.status || f.neuro.status === "nenhuma") ? "selected" : ""}>Nenhuma identificada</option>
          <option value="possivel" ${(f.neuro && f.neuro.status === "possivel") ? "selected" : ""}>Possibilidade</option>
          <option value="confirmada" ${(f.neuro && f.neuro.status === "confirmada") ? "selected" : ""}>Confirmada</option>
        </select>
        <input id="editFriendNeuroDetalhes" class="ach-admin-input full" value="${escapeHtml((f.neuro && f.neuro.detalhes) || "")}" placeholder="Detalhes (ex: TDAH, autismo...) — opcional">
        <div class="ach-admin-row" style="margin-top:8px;">
          <button id="saveFriendEditBtn" class="ach-admin-btn">Salvar alterações</button>
          <button id="resetFriendEditBtn" class="sugg-btn reject">Restaurar original</button>
        </div>
        <div id="editFriendStatus" class="edit-friend-status"></div>
      </div>
    </div>` : ""}
  `;
  if (isAdmin) {
    const editBtn = document.getElementById("editFriendBtn");
    const form = document.getElementById("editFriendForm");
    editBtn.addEventListener("click", ()=>{
      form.style.display = form.style.display === "none" ? "flex" : "none";
    });
    document.getElementById("saveFriendEditBtn").addEventListener("click", async ()=>{
      const status = document.getElementById("editFriendStatus");
      const role = document.getElementById("editFriendRole").value.trim();
      const bio = document.getElementById("editFriendBio").value.trim();
      const actorName = document.getElementById("editFriendActorName").value.trim();
      const neuroStatus = document.getElementById("editFriendNeuroStatus").value;
      const neuroDetalhes = document.getElementById("editFriendNeuroDetalhes").value.trim();
      const fileInput = document.getElementById("editFriendPhotoInput");
      const actorFileInput = document.getElementById("editFriendActorPhotoInput");
      const file = fileInput.files[0];
      const actorFile = actorFileInput.files[0];
      const updates = { neuroStatus, neuroDetalhes };
      if (role) updates.role = role;
      if (bio) updates.bio = bio;
      if (actorName) updates.actorName = actorName;
      status.textContent = "Salvando...";
      try {
        if (file) updates.photo = await readAndCompressImage(file, 420, 0.78);
        if (actorFile) updates.actorPhoto = await readAndCompressImage(actorFile, 420, 0.78);
        await friendOverrideDocRef(f.id).set(updates, { merge: true });
        logActivity(friendTeams(f)[0] || "bigbang", "edited", `editou o perfil de <b>${f.name}</b>`);
        status.textContent = "Salvo!";
        setTimeout(()=> status.textContent = "", 2000);
      } catch (err) {
        status.textContent = "Erro: " + err.message;
      }
    });
    document.getElementById("resetFriendEditBtn").addEventListener("click", async ()=>{
      if (!confirm(`Restaurar os dados originais de ${f.name}? Isso apaga a bio/descrição/foto editadas.`)) return;
      try {
        await friendOverrideDocRef(f.id).delete();
      } catch (err) {
        alert("Erro ao restaurar: " + err.message);
      }
    });
  }
  updateCardTriggerVisibility();
}
/* ============================================================
   BOOT
============================================================ */
function renderAll(){
  renderTabs();
  renderAchievements();
  renderCharGrid();
  renderCharDetail();
  renderEggs();
  renderCards();
  updateCardTriggerVisibility();
}
renderRanking();
renderAll();

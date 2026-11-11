/* Original Crown City screenplay. NFT identities remain references; these events are fictional. */
export function directStory(VN,MISSIONS){
 const scripts={
 intro_news:"Crown City, 11:47 p.m. A Palace convoy has left the harbour without a manifest. Three blocks away, another apartment tower lost its power. Officially, the two events are unrelated.",
 intro_news2:"This is Vera Vale. Tomorrow the council votes to sell Southside to Gold Mage. Tonight, his convoy is carrying the access key to the original debt archive. And an old name just came home.",
 intro_garage:"You picked a hell of a night to come back. They padlocked my shop this morning. 'Outstanding debt.' I paid that debt three times.",
 intro_garage2:"I used to drive for the Palace. I know where they hide the receipts. That van is our way into the vault, Hunter. Then everybody gets to read them.",
 intro_garage3:"Riot's outside. Disable the convoy van, take its sealed archive key, then lose Metro before you come home. That key opens the archive. Don't let them take it back.",
 intro_garage4:"One more thing. A buyer offered chips for that key. We can keep it quiet, or sell a decoy to fund the crew. Either way, the real key comes home with us. Your call. It will have a price.",
 m1_win_safe:"Key's still sealed. Good. Now we need a way inside. Fire called. She knows the Palace service roads. Says she'll only talk to a driver who can keep up.",
 m1_win_flip:"The decoy sold. We have chips, but your buyer wasn't alone. Metro knows who hit the convoy. Fire can still get us inside. First, she wants to see if you deserve the keys.",
 m2_intro:"I ran Palace deliveries for six years. Then they put my brother's name on that ledger. You want my service route? Two laps. Every gate. Show me you can bring a crew home in one piece.",
 m2_intro2:"Keep the route warm. I'm not here for your car, Fire. I'm here because somebody has to put a dent in that building.",
 m2_win:"All right. I trust your hands. The service route is yours. Neural can blind the cameras, but she needs a Metro scrambler. Ask her about the fee before she asks about your kidneys.",
 m2_lose:"You're driving angry. That's how the Palace wins twice. Breathe. Brake before the turn. Run it again. I am not sending my people into a car you can't control.",
 m3_intro:"The city has four thousand cameras and exactly one owner. Gold Mage doesn't just collect debts. He edits them. The archive keeps the originals. We get those, we can prove it.",
 m3_intro2:"Six hundred chips buys the blackout. I can pay now, or you take it from the vault cut. What I won't do is leave the people on that ledger in the dark.",
 m3_win:"Scrambler paired. Ninety seconds of clean air, provided you don't start a war. Mask is inside the Palace. He says the vault schedule changed. Someone is expecting us.",
 m4_intro:"Gold Mage moved the archive upstairs. Left the vault door easy. It's a trap dressed as an invitation. We can borrow a staff badge and stay small, or let Fire make a distraction.",
 m4_quiet:"Borrow the badge. The less they see, the longer we have. And nobody working a night shift takes a bullet for their boss's secrets.",
 m4_loud:"I'll pull the alarm on the opposite wing. Every uniform in the building will hear it. You get one hard window. Don't mistake noise for cover.",
 m4_case:"Walk the south doors. Then the service lot. Stand still and read the sight lines. After that, trace the marina route. Know the exit before you start the argument.",
 m4_win:"South doors mapped. Launch reserved. The archive isn't just debt records, Chaos. It has the names of everyone who disappeared trying to leave the Palace. Vera needs the whole thing.",
 m5_intro:"You drove for me once. You know what this city costs. Do you think a file makes you clean? Every road out of Crown City was paid for by someone who couldn't afford it.",
 m5_intro2:"He's keeping you talking. South doors, archive marker, then the marina. If you're quiet, use Neural's window. If you're loud, keep moving. No hero speeches on my radio.",
 m5_mid:"Archive copied. The blackout is holding. Chaos... your name is in here. You weren't fired. You were listed as dead. Get to the boat. We can argue with ghosts later.",
 m5_win:"You made the island. I pulled your old personnel file. Gold Mage buried your name after the Southside fire. The ledger can clear you. Or buy you a life where nobody asks.",
 m6_intro:"A Nyx is waiting at the marina. Your crew chose a side. Choose yours. Take the east highway and find out whether you wanted justice, or merely a better class of escape.",
 m6_end_safe:"This is Vera Vale. Tonight we're publishing the unedited Palace archive. The council vote has been suspended. Southside's lights are back on. For once, the names on the screen belong to the people who signed the orders.",
 m6_end_flip:"Vera Vale, Crown City News. An anonymous buyer released part of the Palace archive this morning. The tower sales are frozen. Several names remain missing. Somebody got out rich. Somebody else is still waiting.",
 m6_end2:"Hunter keeps the shop. Fire gets her brother's file. Neural gets paid. Mask gets to disappear on his own terms. Me? I think I'll take the long way home.",
 m6_end3:"Then take the radio with you. Crown City will still need a driver tomorrow.",
 };
 for(const [id,text] of Object.entries(scripts))if(VN[id])VN[id].text=text;
 VN.intro_garage4.choices[0].label='Keep the key quiet. Protect the crew.';
 VN.intro_garage4.choices[1].label='Sell a decoy. Fund the job. Take the heat.';
 VN.m3_intro2.choices[0].label='Pay 600 now. No debt between us.';
 VN.m3_intro2.choices[1].label='Take 600 from my vault cut.';
 VN.m4_intro.choices[0].label='Staff entrance. Quiet, no collateral.';
 VN.m4_intro.choices[1].label='Fire makes a diversion. Fast and loud.';
 const blurbs=[
  'Intercept the Palace convoy. Steal the key to its hidden archive.',
  'Earn Fire\'s trust and her route into the Palace.',
  'Buy a blackout. Borrow the city\'s eyes.',
  'Read the doors. Learn the exit. Decide how the city remembers you.',
  'Take the original archive from the man who owns your past.',
  'Get the evidence beyond Gold Mage\'s reach.'
 ];
 const titles=['COLD WALLET','BURNING BRIDGES','DEAD AIR','THE INSIDE LINE','HOUSE OF GLASS','EXIT WOUNDS'];
 MISSIONS.forEach((m,i)=>{m.title=titles[i];m.blurb=blurbs[i];});
}

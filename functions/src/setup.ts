// Diğer tüm dosyalardan ÖNCE yüklenmelidir (index.ts'deki ilk import).
// Fonksiyon tanımları bölge ayarını tanımlandıkları anda okur; bu ayar sonradan
// yapılırsa o dosyadaki fonksiyonlar varsayılan bölgeye (ABD) kurulur.
import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

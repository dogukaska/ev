# Ev Araçları

[Dijital Çakı](https://dogukaska.github.io/) araçları tarayıcıda çalışır.

[Odaya Sığar mı?](https://dogukaska.github.io/ev/yerlesim/)

Oda planı için [FloorPlan 3D](https://github.com/ecy88214/FloorPlan-3D-OpenSource) incelendi.

Odaya Sığar mı?’nın geliştirilmesi, sürüklenebilir 3D önizlemenin eklenmesi ve tarayıcı testleri OpenAI Codex desteğiyle yapıldı.

- [Taşınma Kutusu Bulucu](https://dogukaska.github.io/ev/araclar/?arac=kutu) kutu içeriğinde arama yapar ve etiket yazdırır.
- [Fiş ve Garanti Arşivi](https://dogukaska.github.io/ev/araclar/?arac=garanti) garanti tarihlerini ve fişleri saklar, takvim ve ZIP dosyası verir.
- [Boya Alış Listesi](https://dogukaska.github.io/ev/araclar/?arac=boya) net duvar alanı ile kutu boyuna göre alış listesi çıkarır.
- [Sayaç Okuma Defteri](https://dogukaska.github.io/ev/araclar/?arac=sayac) tarih, endeks, fotoğraf ve tüketim kaydını tutar, CSV dosyası verir.
- [Tarif Kartı](https://dogukaska.github.io/ev/tarif/) tarifleri saklar ve porsiyonları ölçekler.

Kutu, garanti ve sayaç kayıtları cihazda IndexedDB’de saklanır. Garanti ZIP çıktısı için [JSZip](https://github.com/Stuk/jszip), Tarif Kartı’ndaki kesirler için [Fraction.js](https://github.com/rawify/Fraction.js) kullanılır.

Mobilyalarda ayrı parçalardan model oluşturma yaklaşımı FloorPlan 3D’den uyarlandı. [MIT lisansı](yerlesim/FloorPlan-3D-LICENSE) kaynak depoya aittir.

Dört Ev aracının geliştirilmesi, Tarif Kartı’nın Ev’e taşınması, mobilya modellerinin geliştirilmesi ve tarayıcı testleri OpenAI Codex desteğiyle yapıldı.

Odaya Sığar mı? için FloorPlan 3D’nin ev eşyası grupları incelenerek Türkçe, ölçüleri düzenlenebilir 114 hazır eşya eklendi. Katalog, modelleme ve tarayıcı testleri OpenAI Codex desteğiyle yapıldı.

Taşınma Kutusu Bulucu’nun 3D koli yerleşimi, dokunmatik sürükleme, erişilebilir taşıma kontrolleri ve tarayıcı testleri OpenAI Codex desteğiyle geliştirildi.

Serbest koli yerleşimi, döndürme, desteksiz bırakıldığında kayma ve yeni koli düşüş animasyonu OpenAI Codex desteğiyle geliştirildi.

Taşınma Kutusu Bulucu’da koliler tüm sayfada taşınabilir ve köşeden tutularak döndürülebilir. Köşeden döndürme etkileşimi için [Konva](https://konvajs.org/docs/select_and_transform/Rotate_Mode.html), sürükleme sırasında otomatik kaydırma için [interact.js](https://interactjs.io/docs/action-options/#autoscroll) incelendi. Uygulama ve tarayıcı testleri OpenAI Codex desteğiyle geliştirildi.

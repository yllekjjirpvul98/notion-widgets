const express = require('express');
const cors = require('cors')
const app = express();
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

app.engine('ejs', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))


if(process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('X-Forwarded-Proto') !== 'https')
      res.redirect(`https://${req.header('host')}${req.url}`)
    else
      next()
  })
}
app.use(cors())

app.use('/', router);



router.get('/douban-rating/:type/:subjectId', async (req, res) => {

  // Try to get params from router
  var subjectId = req.params.subjectId
  var type = req.params.type
  
  var item = {
      coverImg: '',
      title: '',
      rating: '',
      rating_no: '',
      author: '',
      length: '',
      originalTitle: '',
      ISBN: '',
      translator: '',
      publishedYear: '',
      publisher: '',
      subTitle: ''
  }

  var url = (type === 'book')?  'https://book.douban.com/' : 'https://movie.douban.com/'
  url = url + "/subject/" + subjectId + "/"

  // Try to scrap from douban
  await axios.get(url)
  .then((res) => {

        let $ = cheerio.load(res.data, { decodeEntities: false });

        // Find book title
        item.title = $('div#wrapper').find('h1').find('span').text().trim();

        // Find image url
        $('div#mainpic').find('a').find('img')
            .toArray()
            .map(element => item.coverImg = $(element).attr('src'))

        // Find ratings
        $('div#interest_sectl').find('div').find('div.rating_self').find('strong')
        .toArray()
        .map(element => item.rating = $(element).text().trim())

        // Find number of raters
        item.rating_no = $('a.rating_people').find('span').text().trim()

        // Find the author / translator
        $('div#info').find('span').find('span.pl').toArray().map((e) => {
          let keyword = $(e).text().trim()
          let person = ''
          $(e.parent).find('a').toArray().map((p) => {
              person += $(p).text().trim() + " / "
          })
          person = person.slice(0, -3)
          if (keyword == '作者'){
            item.author = person
          }else {
            item.translator = person
          }
        })

        // Find other info
        let e = $('div#info').find('span.pl + br').toArray()
        let valueList = $(e[0]).prev().parent().text().trim().split("\n").filter(
          (str) => str.includes(":")
        )
        valueList = valueList.filter((line) => {
          return line.split(": ").length >= 2
        })
        valueList = valueList.map((value) => {
          let array = value.split(": ")
          array.shift()
          return array.join(": ")
        })
        let titleList = e.map((element) => $(element).prev().text().trim().slice(0, -1))
        let wanted = ['原作名', 'ISBN', '页数', '出版年', '出版社', '副标题']
        for (var i = 0; i < titleList.length; i++) {
          if (wanted.includes(titleList[i])) {
            switch(titleList[i]) {
              case '副标题':
                item.subTitle = valueList[i]
                break
              case '原作名':
                item.originalTitle = valueList[i]
                break
              case 'ISBN':
                item.ISBN = valueList[i]
                break
              case '页数':
                item.length = valueList[i]
                break
              case '出版年':
                item.publishedYear = valueList[i]
                break
              case '出版社':
                item.publisher = valueList[i]
                break
            }
          }
        }
  })
  res.render('douban', {'item' : item})
})

app.use('/static', express.static(__dirname + '/public'));

app.listen(process.env.PORT || 3000);
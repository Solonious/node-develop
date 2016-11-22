/**
 * Created by sergey.solonar on 22.11.2016.
 */
suite('Тесты страницы "О..."', function(){
    test('страница должна содержать ссылку на страницу контактов', function(){
        assert($('a[href="/contact"]').length);
    });
});
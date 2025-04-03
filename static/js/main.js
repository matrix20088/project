// وظائف عامة للتطبيق
$(document).ready(function() {
    // تفعيل القوائم المنسدلة
    try {
        $('.dropdown-toggle').dropdown();
    } catch (e) {
        console.warn('خطأ في تفعيل القوائم المنسدلة:', e);
    }
    
    // تفعيل رسائل التنبيه (alerts)
    try {
        $('.alert').alert();
    } catch (e) {
        console.warn('خطأ في تفعيل رسائل التنبيه:', e);
    }
    
    // تحسين تحميل صفحة التطبيق
    $(window).on('load', function() {
        setTimeout(function() {
            try {
                // تفعيل مميزات إضافية بعد اكتمال تحميل الصفحة
                $('[data-bs-toggle="tooltip"]').tooltip();
                $('[data-bs-toggle="popover"]').popover();
            } catch (e) {
                console.warn('خطأ في تفعيل التلميحات أو البوبوفر:', e);
            }
            
            // تشغيل وظيفة تهيئة جداول البيانات بمجرد تحميل الصفحة
            try {
                initDataTables();
            } catch (e) {
                console.error('خطأ في تهيئة جداول البيانات:', e);
            }
        }, 500);
    });
    
    // تهيئة DataTables
    window.initDataTables = function() {
        try {
            if (typeof $.fn.dataTable !== 'undefined') {
                // بحث سهل للنصوص العربية
                $.extend($.fn.dataTableExt.oSort, {
                    "arabic-pre": function (data) {
                        return data;
                    },
                    "arabic-asc": function (a, b) {
                        return a.localeCompare(b, 'ar');
                    },
                    "arabic-desc": function (a, b) {
                        return b.localeCompare(a, 'ar');
                    }
                });
                
                // تصحيح الأخطاء قبل تهيئة DataTables
                function fixDataTableColumnCount(tableSelector) {
                    try {
                        // التحقق من وجود الجدول
                        if ($(tableSelector).length === 0) return;
                        
                        // الحصول على عدد الأعمدة في thead
                        var theadColumnCount = $(tableSelector).find('thead tr:first th').length;
                        
                        // التحقق من كل صف في tbody
                        $(tableSelector).find('tbody tr').each(function() {
                            var tbodyColumnCount = $(this).find('td').length;
                            
                            // إذا كان هناك خلية colspan فتأكد من أنها تتضمن العدد الصحيح من الأعمدة
                            if ($(this).find('td[colspan]').length > 0) {
                                $(this).find('td[colspan]').attr('colspan', theadColumnCount);
                                return true; // استمر إلى الصف التالي
                            }
                            
                            // إذا كان عدد الأعمدة في الصف أقل من عدد الأعمدة في الرأس
                            if (tbodyColumnCount < theadColumnCount) {
                                // إضافة خلايا فارغة لتصحيح العدد
                                for (var i = tbodyColumnCount; i < theadColumnCount; i++) {
                                    $(this).append('<td style="display:none;"></td>');
                                }
                            }
                        });
                    } catch (e) {
                        console.error("خطأ في تصحيح أعمدة الجدول:", e);
                    }
                }
                
                // تصحيح جميع جداول DataTables قبل التهيئة
                fixDataTableColumnCount('.dataTable-purchaseRequests');
                fixDataTableColumnCount('.dataTable-purchaseOrders');
                fixDataTableColumnCount('.dataTable-reports');

                // إعداد وظيفة الخطأ لمعالجة أي أخطاء في DataTables بشكل أفضل
                $.fn.dataTable.ext.errMode = function(settings, helpPage, message) {
                    console.warn('DataTables error: ' + message);
                };
            
            try {
                // تهيئة جداول طلبات الشراء - فقط إذا لم تكن مهيئة مسبقًا
                $('.dataTable-purchaseRequests').each(function() {
                    // التحقق مما إذا كان الجدول مهيئًا بالفعل
                    if (!$.fn.dataTable.isDataTable(this)) {
                        $(this).DataTable({
                            language: {
                                url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/ar.json',
                            },
                            responsive: true,
                            paging: true,
                            searching: true,
                            ordering: true,
                            info: true,
                            autoWidth: false,
                            columnDefs: [
                                { orderable: false, targets: -1 } // إيقاف الترتيب للعمود الأخير (عمود العمليات)
                            ]
                        });
                    }
                });
            } catch (e) {
                console.warn('خطأ في تهيئة جدول طلبات الشراء:', e);
            }

            try {
                // تهيئة جداول أوامر الشراء - فقط إذا لم تكن مهيئة مسبقًا
                $('.dataTable-purchaseOrders').each(function() {
                    // التحقق مما إذا كان الجدول مهيئًا بالفعل
                    if (!$.fn.dataTable.isDataTable(this)) {
                        $(this).DataTable({
                            language: {
                                url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/ar.json',
                            },
                            responsive: true,
                            paging: true,
                            searching: true,
                            ordering: true,
                            info: true,
                            autoWidth: false,
                            columnDefs: [
                                { orderable: false, targets: -1 } // إيقاف الترتيب للعمود الأخير (عمود العمليات)
                            ]
                        });
                    }
                });
            } catch (e) {
                console.warn('خطأ في تهيئة جدول أوامر الشراء:', e);
            }

            try {
                // تهيئة جداول التقارير - فقط إذا لم تكن مهيئة مسبقًا
                $('.dataTable-reports').each(function() {
                    // التحقق مما إذا كان الجدول مهيئًا بالفعل
                    if (!$.fn.dataTable.isDataTable(this)) {
                        $(this).DataTable({
                            language: {
                                url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/ar.json',
                            },
                            responsive: true,
                            paging: true,
                            searching: true,
                            ordering: true,
                            info: true,
                            autoWidth: false,
                            columnDefs: [
                                { orderable: false, targets: -1 } // إيقاف الترتيب للعمود الأخير
                            ],
                            dom: '<"d-flex justify-content-between align-items-center mb-3"<"d-flex"B><"d-flex"f>>rtip',
                            buttons: [
                                {
                                    extend: 'copy',
                                    text: '<i class="fas fa-copy"></i> نسخ',
                                    className: 'btn btn-sm btn-outline-primary mx-1',
                                    exportOptions: {
                                        columns: ':visible:not(:last-child)'
                                    }
                                },
                                {
                                    extend: 'excel',
                                    text: '<i class="fas fa-file-excel"></i> إكسل',
                                    className: 'btn btn-sm btn-outline-success mx-1',
                                    exportOptions: {
                                        columns: ':visible:not(:last-child)'
                                    }
                                },
                                {
                                    extend: 'pdf',
                                    text: '<i class="fas fa-file-pdf"></i> PDF',
                                    className: 'btn btn-sm btn-outline-danger mx-1',
                                    exportOptions: {
                                        columns: ':visible:not(:last-child)'
                                    }
                                },
                                {
                                    extend: 'print',
                                    text: '<i class="fas fa-print"></i> طباعة',
                                    className: 'btn btn-sm btn-outline-info mx-1',
                                    exportOptions: {
                                        columns: ':visible:not(:last-child)'
                                    }
                                }
                            ]
                        });
                    }
                });
            } catch (e) {
                console.warn('خطأ في تهيئة جدول التقارير:', e);
            }
        }
    } catch (e) {
        console.error('خطأ في تهيئة DataTables:', e);
    }
    };

    // تفعيل إنشاء النافذة المنبثقة للإشعارات
    window.openNotificationInModal = function(url) {
        var notificationModal = new bootstrap.Modal(document.getElementById('notificationModal'));
        
        // عرض مؤشر التحميل
        var modalBody = document.querySelector('#notificationModal .modal-body');
        modalBody.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">جاري التحميل...</span></div></div>';
        
        // تحميل محتوى الإشعار
        fetch(url)
            .then(response => response.text())
            .then(html => {
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');
                var content = doc.querySelector('.container .card-body') || doc.querySelector('.container .row') || doc.querySelector('main');
                
                if (content) {
                    modalBody.innerHTML = '';
                    modalBody.appendChild(content);
                } else {
                    modalBody.innerHTML = '<div class="alert alert-warning">لا يمكن عرض المحتوى في النافذة المنبثقة. <a href="' + url + '" target="_blank">افتح في صفحة جديدة</a></div>';
                }
            })
            .catch(error => {
                console.error('Error loading notification content:', error);
                modalBody.innerHTML = '<div class="alert alert-danger">حدث خطأ أثناء تحميل المحتوى. <a href="' + url + '" target="_blank">افتح في صفحة جديدة</a></div>';
            });
        
        notificationModal.show();
        return false;
    };
    
    // تم تعطيل الإشعارات المباشرة مؤقتًا
    // إخفاء شارة الإشعارات إذا وجدت
    var notificationBadge = document.getElementById('notification-badge');
    if (notificationBadge) {
        notificationBadge.classList.add('d-none');
    }
    
    // إزالة أي رسائل خطأ متعلقة بالإشعارات محفوظة سابقًا
    var errorMessages = document.querySelectorAll('.websocket-error');
    if (errorMessages.length > 0) {
        errorMessages.forEach(function(element) {
            element.remove();
        });
    }
    
    console.log('تم تعطيل خدمة الإشعارات المباشرة مؤقتًا');
    
    /*
    // الكود الأصلي للإشعارات المباشرة (معطل حالياً)
    setTimeout(function() {
        if (document.getElementById('notification-badge')) {
            // تم تعطيل محاولة تحميل Socket.IO
        }
    }, 1000);
    */
});